import { addBox2dLabel } from '../../src/action/box2d'
import { addPolygon2dLabel } from '../../src/action/polygon2d'
import { actionToQuery, makePolyAction } from '../../src/bot/action_converter'
import { LabelTypeName } from '../../src/const/common'
import { makePathPoint2D, makeRect } from '../../src/functional/states'
import { convertPolygonToExport } from '../../src/server/export'
import { QueryType } from '../../src/types/bot'
import { PathPoint2DType, PathPointType, RectType } from '../../src/types/state'

let sessionId: string
let url: string

beforeAll(() => {
  sessionId = 'sessionId'
  url = 'testurl'
})

describe('test model interface query construction', () => {
  test('rect query construction', () => {
    const rect: RectType = makeRect({
      x1: 5, y1: 2, x2: 6, y2: 10
    })
    const itemIndex = 1
    const rectAction = addBox2dLabel(itemIndex, 0, [], {}, rect)
    const query = actionToQuery(rectAction, url)
    expect(query).not.toEqual(null)
    if (!query) {
      return
    }
    expect(query.type).toBe(QueryType.PREDICT_POLY)
    expect(query.itemIndex).toBe(itemIndex)
    expect(query.url).toBe(url)

    const box2d = query.label.box2d
    expect(box2d).not.toEqual(null)
    if (!box2d) {
      return
    }
    expect(box2d.x1).toEqual(rect.x1)
    expect(box2d.y1).toEqual(rect.y1)
    expect(box2d.x2).toEqual(rect.x2)
    expect(box2d.y2).toEqual(rect.y2)
  })

  test('poly query construction', () => {
    const points = [
      makePathPoint2D({ x: 0, y: 1, pointType: PathPointType.LINE }),
      makePathPoint2D({ x: 5, y: 3, pointType: PathPointType.LINE })
    ]
    const itemIndex = 0
    const polyAction = addPolygon2dLabel(itemIndex, 0, [], points, true)
    const query = actionToQuery(polyAction, url)
    expect(query).not.toEqual(null)
    if (!query) {
      return
    }
    expect(query.type).toBe(QueryType.REFINE_POLY)
    expect(query.itemIndex).toBe(itemIndex)
    expect(query.url).toBe(url)

    const expectedPoly = convertPolygonToExport(
      points, LabelTypeName.POLYGON_2D)
    expect(query.label.poly2d).toEqual(expectedPoly)
  })
})

describe('test model interface action translation', () => {
  test('poly action translation', () => {
    const polyPoints = [[1, 5], [100, -5]]
    const itemIndex = 3
    const action = makePolyAction(polyPoints, itemIndex, sessionId)
    expect(action.sessionId).toBe(sessionId)

    const label = action.labels[0][0]
    expect(label.manual).toBe(false)

    const points = action.shapes[0][0] as PathPoint2DType[]
    expect(points[0]).toMatchObject({ x: 1, y: 5, pointType: 'line' })
    expect(points[1]).toMatchObject({ x: 100, y: - 5, pointType: 'line' })
  })
})
