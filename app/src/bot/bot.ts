import io from 'socket.io-client'
import { deleteLabels } from '../action/common'
import { configureStore } from '../common/configure_store'
import { uid } from '../common/uid'
import { index2str } from '../common/util'
import { EventName } from '../const/connection'
import Logger from '../server/logger'
import { getGRPCConnFailedMsg } from '../server/util'
import { AddLabelsAction, BaseAction, DeleteLabelsAction } from '../types/action'
import { BotData } from '../types/bot'
import {
  ActionPacketType, RegisterMessageType, SyncActionMessageType
} from '../types/message'
import { ReduxStore } from '../types/redux'
import { State } from '../types/state'
import { getQuery, makePolyAction } from './action_converter'
import { DeploymentClient } from './deployment_client'
import { parseInstanceSegmentationResult } from './proto_utils'
import { QueryPreparer } from './query_preparer'

type BotAction = AddLabelsAction | DeleteLabelsAction

/**
 * Manages virtual sessions for a single bot
 */
export class Bot {
  /** Project name */
  public projectName: string
  /** Task index */
  public taskIndex: number
  /** Bot user id */
  public botId: string
  /** An arbitrary session id */
  public sessionId: string
  /** Address for session connections */
  public address: string
  /** The store to save state */
  protected store: ReduxStore
  /** Socket connection */
  protected socket: SocketIOClient.Socket
  /** Timestamped log for completed actions */
  protected actionLog: BaseAction[]
  /** Log of packets that have been acked */
  protected ackedPackets: Set<string>
  /** Number of actions received via broadcast */
  private actionCount: number
  /** The deployment client for the models */
  private deploymentClient: DeploymentClient

  /**
   * Constructor
   *
   * @param deploymentClient
   * @param botData
   */
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
    const socket = io.connect(this.address, {
      transports: ["websocket"],
      upgrade: false
    })
    this.socket = socket

    this.socket.on(EventName.CONNECT, this.connectHandler.bind(this))
    this.socket.on(EventName.REGISTER_ACK, this.registerAckHandler.bind(this))
    this.socket.on(
      EventName.ACTION_BROADCAST,
      this.actionBroadcastHandler.bind(this)
    )

    this.store = configureStore({})

    this.actionLog = []
    this.ackedPackets = new Set()
  }

  /**
   * Called when io socket establishes a connection
   * Registers the session with the backend, triggering a register ack
   */
  public connectHandler(): void {
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
   *
   * @param syncState
   */
  public registerAckHandler(syncState: State): void {
    this.store = configureStore(syncState)
  }

  /**
   * Called when backend sends ack for actions that were sent to be synced
   * Simply logs these actions for now
   *
   * @param message
   */
  public async actionBroadcastHandler (
    message: SyncActionMessageType): Promise<BotAction[]> {
    const actionPacket = message.actions
    // If action was already acked, or if action came from a bot, ignore it
    if (this.ackedPackets.has(actionPacket.id)
      || !message.shouldTriggerBot
      || message.sessionId === this.sessionId) {
      return []
    }

    this.ackedPackets.add(actionPacket.id)

    // Precompute queries so they can potentially execute in parallel
    const queryPreparer = this.packetToQueries(actionPacket)

    // Send the queries for execution on the deployment server
    const actions = await this.executeQueries(queryPreparer)

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
   *
   * @param actions
   * @param triggerId
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
      shouldTriggerBot: false
    }
    this.socket.emit(EventName.ACTION_SEND, message)
  }

  /**
   * Close any external resources
   */
  public kill(): void {
    this.socket.disconnect()
  }

  /**
   * Gets the number of actions for the bot
   */
  public getActionCount(): number {
    return this.actionCount
  }

  /**
   * Sets action counts to 0 for the bot
   */
  public resetActionCount(): void {
    this.actionCount = 0
  }

  /**
   * Wraps instance variables into data object
   */
  public getData(): BotData {
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
  public getState(): State {
    return this.store.getState().present
  }

  /**
   * Execute queries and get the resulting actions
   * Batches the queries for each endpoint
   *
   * @param queries
   */
  private async executeQueries (
    queryPreparer: QueryPreparer):
    Promise<BotAction[]> {
    const actions: BotAction[] = []
    // TODO: currently waits for each endpoint sequentially, can parallelize
    for (const queryType of queryPreparer.getQueryTypes()) {
      try {
        const resp = await this.deploymentClient.infer(
          queryType,
          queryPreparer.getUrls(queryType),
          queryPreparer.getLabelLists(queryType)
        )
        Logger.info(
          `Got a ${resp.getMessage()} response from the model`)
        resp.getInstanceSegmentationResultList().forEach(
          (segmentationResult, index: number) => {
            parseInstanceSegmentationResult(segmentationResult).forEach(
              (polyPoints: number[][]) => {
                actions.push(makePolyAction(
                  polyPoints,
                  queryPreparer.getItemIndices(queryType)[index],
                  this.sessionId
                ))
              })
          })
        actions.push(deleteLabels(
          queryPreparer.getItemIndices(queryType),
          queryPreparer.getLabelIds(queryType)
        ))
      } catch (e) {
        Logger.info(getGRPCConnFailedMsg(queryType.toString(), e.message))
      }
    }
    return actions
  }

  /**
   * Compute queries for the actions in the packet
   *
   * @param packet
   */
  private packetToQueries (
    packet: ActionPacketType): QueryPreparer {
    const queryPreparer = new QueryPreparer()
    for (const action of packet.actions) {
      if (action.sessionId !== this.sessionId) {
        this.actionCount += 1
        this.actionLog.push(action)
        this.store.dispatch(action)
        Logger.info(`Bot received action of type ${action.type}`)

        const state = this.store.getState().present
        queryPreparer.addQuery(getQuery(state, action))
      }
    }
    return queryPreparer
  }
}
