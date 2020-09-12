import * as protoLoader from '@grpc/proto-loader'
import * as grpc from 'grpc'
import { BotConfig } from '../types/config'

/**
 * Create a GRPC stub for the model deployment service.
 */
function makeGRPCStub (config: BotConfig) {
  const PROTO_PATH = __dirname + '/../../proto/model_deployment_service.proto'

  // Suggested options for similarity to existing grpc.load behavior
  const packageDefinition = protoLoader.loadSync(
      PROTO_PATH,
    {keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    })
  const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any

  // The protoDescriptor object has the full package hierarchy
  const service = protoDescriptor.deployment_service.DeploymentService

  const modelAddress = new URL(config.host)
  modelAddress.port = config.port.toString()

  return new service(
    modelAddress.toString(), grpc.credentials.createInsecure()
  )
}

/**
 * Create a deployment task for polygons
 */
async function createTask (grpcStub: any) {
  return new Promise((resolve, reject) => {
    grpcStub.createDeploymentTask({
      project_id: 'abcde12345',
      task_type: 0
    }, (err: Error, result: any) => {
      if (err) {
        reject(err)
        return
      }
      resolve(result)
    })
  })
}

async function deployModel (grpcStub: any, deployId: string) {
  return new Promise((resolve, reject) => {
    grpcStub.deployModel({
      project_id: 'abcde12345',
      num_gpus: 1,
      deployment_task_id: deployId
    }, (err: Error, result: any) => {
      if (err) {
        reject(err)
        return
      }
      resolve(result)
    })
  })
}

async function infer (grpcStub: any, deployId: string) {
  return new Promise((resolve, reject) => {
    grpcStub.performInference({
      project_id: 'abcde12345',
      url_list: ['https://datusagemaker.s3-us-west-2.amazonaws.com/toy/000000.png'],
      deployment_task_id: deployId
    }, (err: Error, result: any) => {
      if (err) {
        reject(err)
        return
      }
      resolve(result)
    })
  })
}

export async function startModel (config: BotConfig) {
  const stub = makeGRPCStub(config)
  const res = await createTask(stub)
  let deployId = (res as any).deployment_task_id as string
  const res2 = await deployModel(stub, deployId)
  deployId = (res2 as any).deployment_task_id as string
  const res3 = await infer(stub, deployId)
  console.log((res3 as any).detection_result[0].detections)
}
