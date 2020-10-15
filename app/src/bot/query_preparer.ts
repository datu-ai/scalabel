import { ModelQuery, QueryType } from "../types/bot"
import { LabelExport } from "../types/export"

// Map from item index to queries for the item
type QueriesByItem = Map<number, ItemQueries>

// Map from query type to all queries with that type
type QueriesByType = Map<QueryType, QueriesByItem>

/** Grouping of queries for a single item */
interface ItemQueries {
  /** Image url for the item */
  url: string
  /** List of queries for the item */
  queries: ModelQuery[]
}

/**
 * Class to prepare and group the queries for an inference batch
 */
export class QueryPreparer {
  /** Internal format for the queries */
  private readonly queriesByType: QueriesByType

  /**
   * Constructor
   */
  constructor() {
    this.queriesByType = new Map()
  }

  /**
   * Add a new query to the batch
   *
   * @param query
   */
  public addQuery(query: ModelQuery | null): void {
    if (query === null) {
      return
    }
    const defaultQueriesByItem: QueriesByItem = new Map()
    const queriesByItem =
      this.queriesByType.get(query.type) ?? defaultQueriesByItem

    const defaultItemQueries: ItemQueries = {
      url: query.url,
      queries: []
    }
    const itemQueries = queriesByItem.get(query.itemIndex) ?? defaultItemQueries

    itemQueries.queries.push(query)
    queriesByItem.set(query.itemIndex, itemQueries)
    this.queriesByType.set(query.type, queriesByItem)
  }

  /**
   * Get all the types of queries in the batch
   */
  public getQueryTypes(): QueryType[] {
    return Array.from(this.queriesByType.keys())
  }

  /**
   * Get the list of urls for a query type
   *
   * @param queryType
   */
  public getUrls(queryType: QueryType): string[] {
    return this.getItemQueries(queryType).map((itemQuery) => itemQuery.url)
  }

  /**
   * Get the item indices for each url for a query type
   *
   * @param queryType
   */
  public getItemIndices(queryType: QueryType): number[] {
    return Array.from(this.queriesByType.get(queryType)?.keys() ?? [])
  }

  /**
   * Get the lists of labels for a query type
   * Should have the same length as the url list
   *
   * @param queryType
   */
  public getLabelLists(queryType: QueryType): LabelExport[][] {
    return this.getItemQueries(queryType).map((itemQuery) =>
      itemQuery.queries.map((query) => query.label)
    )
  }

  /**
   * Get the label IDs corresponding to the label lists for a query type
   *
   * @param queryType
   */
  public getLabelIds(queryType: QueryType): string[][] {
    return this.getItemQueries(queryType).map((itemQuery) =>
      itemQuery.queries.map((query) => query.label.id as string)
    )
  }

  /**
   * Get the item queries for a query type
   *
   * @param queryType
   */
  private getItemQueries(queryType: QueryType): ItemQueries[] {
    return Array.from(this.queriesByType.get(queryType)?.values() ?? [])
  }
}
