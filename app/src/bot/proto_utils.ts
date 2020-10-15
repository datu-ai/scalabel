import { Box2DType } from "../types/export"
import * as messages from "./proto_gen/model_deployment_service_pb.js"

/**
 * Convert a box list from BDD format to proto format
 *
 * @param boxList
 */
export function boxListToProto(
  boxList: Array<Box2DType | null>
): messages.BoxList {
  const protoBoxList = new messages.BoxList()
  boxList.forEach((box) => {
    if (box === null) {
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
 *
 * @param resp
 */
export function parseInstanceSegmentationResult(
  resp: messages.InstanceSegmentationResult
): number[][][] {
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
