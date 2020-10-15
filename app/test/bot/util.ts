import { makeStub } from "../../src/bot/deployment_client"
import { DeploymentServiceClient } from "../../src/bot/proto_gen/model_deployment_service_grpc_pb"
import * as messages from "../../src/bot/proto_gen/model_deployment_service_pb.js"
import { BotConfig } from "../../src/types/config"

/**
 * Helper function to generate model result given a request
 *
 * @param request
 */
function getDummyModelResult(
  request: messages.InferenceRequest
): messages.InferenceResponse {
  const segmentations: messages.InstanceSegmentationResult[] = []
  for (const boxList of request.getBoxListsList()) {
    const segmentation = new messages.InstanceSegmentationResult()
    for (const _box of boxList.getBoxesList()) {
      const polygon = new messages.Polygon()
      for (let i = 0; i < 5; i++) {
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
  result.setMessage("success")
  return result
}

/**
 * Mock the GRPC endpoints for a full test
 *
 * @param botConfig
 */
export function makeMockGRPCStub(
  botConfig: BotConfig
): DeploymentServiceClient | null {
  const stub = makeStub(botConfig)
  if (stub === null) {
    return null
  }

  // For task creation, just call the callback with the deploy id
  stub.createDeploymentTask = jest
    .fn()
    .mockImplementation(
      (
        _req: messages.CreateDeploymentTaskRequest,
        callback: (
          error: Error | null,
          result: messages.CreateDeploymentTaskResponse
        ) => void
      ) => {
        const resp = new messages.CreateDeploymentTaskResponse()
        resp.setDeploymentTaskId("testDeployId")
        callback(null, resp)
      }
    )

  // For deploy, just call the callback
  stub.deployModel = jest
    .fn()
    .mockImplementation(
      (
        _req: messages.DeployRequest,
        callback: (error: Error | null, result: messages.DeployResponse) => void
      ) => {
        callback(null, new messages.DeployResponse())
      }
    )

  // For inference, return the same number of predictions as requests
  stub.performInference = jest
    .fn()
    .mockImplementation(
      (
        request: messages.InferenceRequest,
        callback: (
          error: Error | null,
          result: messages.InferenceResponse
        ) => void
      ) => {
        const resp = getDummyModelResult(request)
        callback(null, resp)
      }
    )
  return stub
}
