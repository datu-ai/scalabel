import * as grpc from 'grpc'
import * as common from './proto_gen/commons_pb.js'
import * as services from './proto_gen/model_deployment_service_grpc_pb.js'
import * as messages from './proto_gen/model_deployment_service_pb.js'

/**
 * Get an stub for the model deployment client.
 */
function getGRPCStub (): services.DeploymentServiceClient {
  return new services.DeploymentServiceClient(
    'localhost:52051', grpc.credentials.createInsecure()
  )
}

/**
 * Initial set up to deploy a model
 */
async function createTask (
  grpcStub: services.DeploymentServiceClient):
  Promise<messages.CreateDeploymentTaskResponse> {
  const req = new messages.CreateDeploymentTaskRequest()
  const taskType = common.TaskType.OBJECT_DETECTION_2D
  req.setProjectId('abcde12345')
  req.setTaskType(taskType)

  return new Promise((resolve, reject) => {
    grpcStub.createDeploymentTask(req,
      (err: Error | null, result: messages.CreateDeploymentTaskResponse) => {
        if (err) {
          reject(err)
          return
        }
        resolve(result)
      })
  })
}

/**
 * Deploy an initialized model
 */
async function deployModel (
  grpcStub: services.DeploymentServiceClient, deployId: string):
  Promise<messages.DeployResponse> {
  const req = new messages.DeployRequest()
  req.setProjectId('abcde12345')
  req.setNumGpus(1)
  req.setDeploymentTaskId(deployId)

  return new Promise((resolve, reject) => {
    grpcStub.deployModel(req,
      (err: Error | null, result: messages.DeployResponse) => {
        if (err) {
          reject(err)
          return
        }
        resolve(result)
      })
  })
}

/**
 * Do inference on a deployed model
 */
async function infer (
  grpcStub: services.DeploymentServiceClient, deployId: string):
  Promise<messages.InferenceResponse> {
  const req = new messages.InferenceRequest()
  req.setProjectId('abcde12345')
  req.setDeploymentTaskId(deployId)
  req.setUrlListList(['https://datusagemaker.s3-us-west-2.amazonaws.com/toy/000000.png'])
  return new Promise((resolve, reject) => {
    grpcStub.performInference(req, (
      err: Error | null, result: messages.InferenceResponse) => {
      if (err) {
        reject(err)
        return
      }
      resolve(result)
    })
  })
}

/**
 * Set up and perform inference
 */
async function main () {
  const stub = getGRPCStub()
  const res = await createTask(stub)
  let deployId = res.getDeploymentTaskId()
  const res2 = await deployModel(stub, deployId)
  deployId = res2.getDeploymentTaskId()
  const res3 = await infer(stub, deployId)
  console.log(res3.getDetectionResultList()[0].getDetectionsList())
}

main().then().catch((err: Error) => {
  console.log(err)
})
