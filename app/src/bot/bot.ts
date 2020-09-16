import io from 'socket.io-client'
import { deleteLabels } from '../action/common'
import { configureStore } from '../common/configure_store'
import { uid } from '../common/uid'
import { index2str } from '../common/util'
import { EventName } from '../const/connection'
import Logger from '../server/logger'
import { getGRPCConnFailedMsg } from '../server/util'
import { AddLabelsAction, BaseAction, DeleteLabelsAction } from '../types/action'
import { BotData, ItemQueries, QueriesByItem, QueriesByType } from '../types/bot'
import {
  ActionPacketType, RegisterMessageType, SyncActionMessageType
} from '../types/message'
import { ReduxStore } from '../types/redux'
import { State } from '../types/state'
import { ActionConverter } from './action_converter'
import { DeploymentClient } from './deployment_client'
import { parseInstanceSegmentationResult } from './proto_utils'

type BotAction = AddLabelsAction | DeleteLabelsAction

/**
 * Manages virtual sessions for a single bot
 */
export class Bot {
  /** project name */
  public projectName: string
  /** task index */
  public taskIndex: number
  /** bot user id */
  public botId: string
  /** an arbitrary session id */
  public sessionId: string
  /** address for session connections */
  public address: string
  /** The store to save state */
  protected store: ReduxStore
  /** Socket connection */
  protected socket: SocketIOClient.Socket
  /** Timestamped log for completed actions */
  protected actionLog: BaseAction[]
  /** Log of packets that have been acked */
  protected ackedPackets: Set<string>
  /** Converter for redux actions */
  protected actionConverter: ActionConverter
  /** Number of actions received via broadcast */
  private actionCount: number
  /** The deployment client for the models */
  private deploymentClient: DeploymentClient

  constructor (
    deploymentClient: DeploymentClient, botData: BotData) {
    this.deploymentClient = deploymentClient
    this.projectName = botData.projectName
    this.taskIndex = botData.taskIndex
    this.botId = botData.botId
    this.address = botData.address
    this.sessionId = uid()

    this.actionCount = 0

    // Create a socketio client
    const socket = io.connect(
      this.address,
      { transports: ['websocket'], upgrade: false }
    )
    this.socket = socket

    this.socket.on(EventName.CONNECT, this.connectHandler.bind(this))
    this.socket.on(EventName.REGISTER_ACK, this.registerAckHandler.bind(this))
    this.socket.on(EventName.ACTION_BROADCAST,
      this.actionBroadcastHandler.bind(this))

    this.store = configureStore({})

    this.actionLog = []
    this.ackedPackets = new Set()

    this.actionConverter = new ActionConverter(this.projectName)
  }

  /**
   * Called when io socket establishes a connection
   * Registers the session with the backend, triggering a register ack
   */
  public connectHandler () {
    const message: RegisterMessageType = {
      projectName: this.projectName,
      taskIndex: this.taskIndex,
      sessionId: this.sessionId,
      userId: this.botId,
      address: this.address,
      bot: true
    }
    /* Send the registration message to the backend */
    this.socket.emit(EventName.REGISTER, message)
  }

  /**
   * Called when backend sends ack of registration of this session
   * Initialized synced state
   */
  public registerAckHandler (syncState: State) {
    this.store = configureStore(syncState)
  }

  /**
   * Called when backend sends ack for actions that were sent to be synced
   * Simply logs these actions for now
   */
  public async actionBroadcastHandler (
    message: SyncActionMessageType): Promise<BotAction[]> {
    const actionPacket = message.actions
    // If action was already acked, or if action came from a bot, ignore it
    if (this.ackedPackets.has(actionPacket.id)
      || message.bot
      || message.sessionId === this.sessionId) {
      return []
    }

    this.ackedPackets.add(actionPacket.id)

    // Precompute queries so they can potentially execute in parallel
    const queriesByType = this.packetToQueries(actionPacket)

    // Send the queries for execution on the deployment server
    const actions = await this.executeQueries(queriesByType)

    // Dispatch the predicted actions locally
    for (const action of actions) {
      this.store.dispatch(action)
    }

    // Broadcast the predicted actions to other session
    if (actions.length > 0) {
      this.broadcastActions(actions, actionPacket.id)
    }

    // Return actions for testing purposes
    return actions
  }

  /**
   * Broadcast the synthetically generated actions
   */
  public broadcastActions (
    actions: BotAction[], triggerId: string) {
    const actionPacket: ActionPacketType = {
      actions,
      id: uid(),
      triggerId
    }
    const message: SyncActionMessageType = {
      taskId: index2str(this.taskIndex),
      projectName: this.projectName,
      sessionId: this.sessionId,
      actions: actionPacket,
      bot: true
    }
    this.socket.emit(EventName.ACTION_SEND, message)
  }

  /**
   * Close any external resources
   */
  public kill () {
    this.socket.disconnect()
  }

  /**
   * Gets the number of actions for the bot
   */
  public getActionCount (): number {
    return this.actionCount
  }

  /**
   * Sets action counts to 0 for the bot
   */

  public resetActionCount () {
    this.actionCount = 0
  }

  /**
   * Wraps instance variables into data object
   */
  public getData (): BotData {
    return {
      botId: this.botId,
      projectName: this.projectName,
      taskIndex: this.taskIndex,
      address: this.address
    }
  }

  /**
   * Get the current redux state
   */
  public getState (): State {
    return this.store.getState().present
  }

  /**
   * Execute queries and get the resulting actions
   * Batches the queries for each endpoint
   */
  private async executeQueries (
    queriesByType: QueriesByType):
    Promise<BotAction[]> {
    const actions: BotAction[] = []
    // TODO: currently waits for each endpoint sequentially, can parallelize
    for (const [queryType, queriesByItem] of queriesByType) {
      const itemIndices = Array.from(queriesByItem.keys())
      const itemQueries = Array.from(queriesByItem.values())
      const urls = itemQueries.map((itemQuery) => itemQuery.url)
      const labelLists = itemQueries.map((itemQuery) =>
        itemQuery.queries.map((query) => query.label)
      )
      const labelIds = itemQueries.map((itemQuery) =>
        itemQuery.queries.map((query) => query.label.id as string)
      )

      try {
        const resp = await this.deploymentClient.infer(
          queryType, urls, labelLists)
        Logger.info(
          `Got a ${resp.getMessage()} response from the model`)
        resp.getInstanceSegmentationResultList().forEach(
          (segmentationResult, index: number) => {
            parseInstanceSegmentationResult(segmentationResult).forEach(
              (polyPoints: number[][]) => {
                actions.push(this.actionConverter.makePolyAction(
                  polyPoints, itemIndices[index]
                ))
              })
          })
        actions.push(deleteLabels(itemIndices, labelIds))
      } catch (e) {
        Logger.info(getGRPCConnFailedMsg(queryType.toString(), e.message))
      }
    }
    return actions
  }

  /**
   * Compute queries for the actions in the packet
   */
  private packetToQueries (
    packet: ActionPacketType): QueriesByType {
    const queriesByType: QueriesByType = new Map()
    for (const action of packet.actions) {
      if (action.sessionId !== this.sessionId) {
        this.actionCount += 1
        this.actionLog.push(action)
        this.store.dispatch(action)
        Logger.info(
          `Bot received action of type ${action.type}`)

        const state = this.store.getState().present
        const query = this.actionConverter.getQuery(state, action)
        if (query) {
          const defaultQueriesByItem: QueriesByItem = new Map()
          const queriesByItem =
            queriesByType.get(query.type) || defaultQueriesByItem

          const defaultItemQueries: ItemQueries = {
            url: query.url, queries: []
          }
          const itemQueries =
            queriesByItem.get(query.itemIndex) || defaultItemQueries

          itemQueries.queries.push(query)
          queriesByItem.set(query.itemIndex, itemQueries)
          queriesByType.set(query.type, queriesByItem)
        }
      }
    }
    return queriesByType
  }
}
