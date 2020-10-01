import { BaseAction } from './action'

export interface RegisterMessageType {
  /** Project name of the session */
  projectName: string
  /** Task index of the session */
  taskIndex: number
  /** Current session Id */
  sessionId: string
  /** Current user Id */
  userId: string
  /** server address */
  address: string
  /** whether it came from a bot or not */
  bot: boolean
}

/** action type for synchronization between front and back ends */
export interface SyncActionMessageType {
  /** Task Id. It is supposed to be index2str(taskIndex) */
  taskId: string
  /** Project name */
  projectName: string
  /** Session Id */
  sessionId: string
  /** List of actions for synchronization */
  actions: ActionPacketType
  /** whether they should trigger bot actions */
  shouldTriggerBot: boolean
}

/** type for transmitted packet of actions */
export interface ActionPacketType {
  /** list of actions in the packet */
  actions: BaseAction[]
  /** id of the packet */
  id: string
  /** for bot actions, id of the action packet that triggered them */
  triggerId?: string
}
