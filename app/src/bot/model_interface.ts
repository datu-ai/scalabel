import { addPolygon2dLabel } from '../action/polygon2d'
import { ADD_LABELS } from '../const/action'
import { ShapeTypeName } from '../const/common'
import { makeLabelExport, makeSimplePathPoint2D } from '../functional/states'
import { convertPolygonToExport } from '../server/export'
import { AddLabelsAction, BaseAction } from '../types/action'
import { ModelQuery, QueryType } from '../types/bot'
import { PathPoint2DType, PathPointType, RectType } from '../types/state'

/**
 * Type guard for add labels actions
 */
function isAddLabelAction (action: BaseAction): action is AddLabelsAction {
  return action.type === ADD_LABELS
}

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
    action: BaseAction, url: string, itemIndex: number) {
    if (!isAddLabelAction(action)) {
      return null
    }
    const shapeType = action.shapes[0][0][0].shapeType
    const shapes = action.shapes[0][0]
    const label = action.labels[0][0]
    switch (shapeType) {
      case ShapeTypeName.RECT:
        return this.makeRectQuery(
          shapes[0] as RectType, url, itemIndex, label.id
        )
      case ShapeTypeName.POLYGON_2D:
        return this.makePolyQuery(
          shapes as PathPoint2DType[], url, itemIndex, label.id, label.type
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
    rect: RectType, url: string, itemIndex: number, id: string): ModelQuery {
    const label = makeLabelExport({
      box2d: rect,
      id
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
    itemIndex: number, id: string, labelType: string): ModelQuery {
    const poly2d = convertPolygonToExport(points, labelType)
    const label = makeLabelExport({
      poly2d,
      id
    })
    return {
      label,
      url,
      type: QueryType.REFINE_POLY,
      itemIndex
    }
  }
}
