import { addPolygon2dLabel } from '../action/polygon2d'
import { ADD_LABELS } from '../const/action'
import { ShapeTypeName } from '../const/common'
import { makeLabelExport, makeSimplePathPoint2D } from '../functional/states'
import { convertPolygonToExport } from '../server/export'
import { AddLabelsAction, BaseAction } from '../types/action'
import { LabelExport } from '../types/bdd'
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
    action: BaseAction, url: string, itemIndex: number): ModelQuery | null {
    if (!isAddLabelAction(action)) {
      return null
    }
    const shapes = action.shapes[0][0]
    const shapeType = shapes[0].shapeType
    const label = action.labels[0][0]

    let labelExport: LabelExport
    let queryType: QueryType
    switch (shapeType) {
      case ShapeTypeName.RECT:
        labelExport = makeLabelExport({
          box2d: shapes[0] as RectType,
          id: label.id
        })
        queryType = QueryType.PREDICT_POLY
        break
      case ShapeTypeName.PATH_POINT_2D:
        labelExport = makeLabelExport({
          poly2d: convertPolygonToExport(
            shapes as PathPoint2DType[], label.type),
          id: label.id
        })
        queryType = QueryType.REFINE_POLY
        break
      default:
        return null
    }

    return {
      url,
      itemIndex,
      label: labelExport,
      type: queryType
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
}
