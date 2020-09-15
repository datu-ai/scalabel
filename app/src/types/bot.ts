import { LabelExport } from './bdd'

/** Data kept by each bot user */
export interface BotData {
  /** The project name */
  projectName: string
  /** The index of the task */
  taskIndex: number
  /** The bot user id */
  botId: string
  /** The address of the io server */
  address: string
}

/** Precomputed queries for models */
export interface ModelQuery {
  /** The label in bdd format */
  label: LabelExport
  /** Image url */
  url: string
  /** The type of query */
  type: QueryType
  /** The index of the item modified */
  itemIndex: number
}

/** Grouping of queries for a single item */
export interface ItemQueries {
  /** Image url for the item */
  url: string
  /** List of queries for the item */
  queries: ModelQuery[]
}

// Map from item index to queries for the item
export type QueriesByItem = Map<number, ItemQueries>

// Map from query type to all queries with that type
export type QueriesByType = Map<QueryType, QueriesByItem>

/**
 * The supported model queries
 * One model can support multiple queries
 */
export const enum QueryType {
  PREDICT_POLY = 'predictPoly',
  REFINE_POLY = 'refinePoly'
}

/**
 * The supported model types
 */
export enum ModelType {
  INSTANCE_SEGMENTATION = 'INSTANCE_SEGMENTATION',
  OBJECT_DETECTION_2D = 'OBJECT_DETECTION_2D'
}
