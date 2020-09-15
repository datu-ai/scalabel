import { addPolygon2dLabel } from '../action/polygon2d'
import { ShapeTypeName } from '../const/common'
import { makeLabelExport, makeSimplePathPoint2D } from '../functional/states'
import { convertPolygonToExport } from '../server/export'
import { AddLabelsAction } from '../types/action'
import { ModelQuery, QueryType } from '../types/bot'
import { PathPoint2DType, PathPointType, RectType } from '../types/state'

/**
 * API between redux style data and data for the models
 */
export class ModelInterface {
  /** project name */
  public projectName: string
  /** current session id */
  public sessionId: string

  constructor (projectName: string, sessionId: string) {
    this.projectName = projectName
    this.sessionId = sessionId
  }

  /**
   * Generate BDD data format item corresponding to the action
   * Only handles box2d/polygon2d actions, so assume a single label/shape/item
   * If action is not handled, returns null
   */
  public actionToQuery (
    action: AddLabelsAction, url: string, itemIndex: number) {
    const shapeType = action.shapes[0][0][0].shapeType
    const shapes = action.shapes[0][0]
    const labelType = action.labels[0][0].type
    switch (shapeType) {
      case ShapeTypeName.RECT:
        return this.makeRectQuery(
          shapes[0] as RectType, url, itemIndex
        )
      case ShapeTypeName.POLYGON_2D:
        return this.makePolyQuery(
          shapes as PathPoint2DType[], url, itemIndex, labelType
        )
      default:
        return null
    }
  }

  /**
   * Translate polygon response to an action
   */
  public makePolyAction (
    polyPoints: number[][], itemIndex: number): AddLabelsAction {
    const points = polyPoints.map((point: number[]) => {
      return makeSimplePathPoint2D(
          point[0], point[1], PathPointType.LINE)
    })

    const action = addPolygon2dLabel(
      itemIndex, -1, [0], points, true, false
    )
    action.sessionId = this.sessionId
    return action
  }

  /**
   * Query for 'rect -> polygon' segmentation
   */
  public makeRectQuery (
    rect: RectType, url: string, itemIndex: number): ModelQuery {
    const label = makeLabelExport({
      box2d: rect
    })

    return {
      label,
      url,
      type: QueryType.PREDICT_POLY,
      itemIndex
    }
  }

  /**
   * Query for refining 'polygon -> polygon' segmentation
   */
  public makePolyQuery (
    points: PathPoint2DType[], url: string,
    itemIndex: number, labelType: string): ModelQuery {
    const poly2d = convertPolygonToExport(points, labelType)
    const label = makeLabelExport({
      poly2d
    })
    return {
      label,
      url,
      type: QueryType.REFINE_POLY,
      itemIndex
    }
  }
}
