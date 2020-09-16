import { Box2DType } from '../types/bdd'
import * as messages from './proto_gen/model_deployment_service_pb.js'

/**
 * Helper function to generate model result given a request
 */
export function getDummyModelResult (
  request: messages.InferenceRequest):
  messages.InferenceResponse {
  const segmentations: messages.InstanceSegmentationResult[] = []
  for (const boxList of request.getBoxListsList()) {
    const segmentation = new messages.InstanceSegmentationResult()
    for (const _box of boxList.getBoxesList()) {
      const polygon = new messages.Polygon()
      for (let i = 0; i++; i < 5) {
        const point = new messages.Point()
        point.setX(Math.random())
        point.setY(Math.random())
        polygon.addPoints(point)
      }
      segmentation.addPolygons(polygon)
    }
    segmentations.push(segmentation)
  }
  const result = new messages.InferenceResponse()
  result.setInstanceSegmentationResultList(segmentations)
  result.setMessage('success')
  return result
}

/**
 * Convert a box list from BDD format to proto format
 */
export function boxListToProto (
  boxList: Array<Box2DType | null>): messages.BoxList {
  const protoBoxList = new messages.BoxList()
  boxList.forEach((box) => {
    if (!box) {
      return
    }
    const protoBox = new messages.Box()
    const bottomLeft = new messages.Point()
    bottomLeft.setX(box.x1)
    bottomLeft.setY(box.y1)
    const topRight = new messages.Point()
    topRight.setX(box.x2)
    topRight.setY(box.y2)

    protoBox.setBottomLeft(bottomLeft)
    protoBox.setTopRight(topRight)
    protoBoxList.addBoxes(protoBox)
  })
  return protoBoxList
}

/**
 * Parse the instance segmentation result into a list of polygons
 * Each polygon is a list of points
 */
export function parseInstanceSegmentationResult (
  resp: messages.InstanceSegmentationResult): number[][][] {
  const polygons: number[][][] = []
  resp.getPolygonsList().forEach((polyProto) => {
    const polygon: number[][] = []
    polyProto.getPointsList().forEach((pointProto) => {
      polygon.push([pointProto.getX(), pointProto.getY()])
    })
    polygons.push(polygon)
  })
  return polygons
}
