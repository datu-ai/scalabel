import * as grpc from 'grpc'
import logger from '../server/logger'
import { BotConfig } from '../types/config'
import * as common from './proto_gen/commons_pb.js'
import * as services from './proto_gen/model_deployment_service_grpc_pb.js'
import * as messages from './proto_gen/model_deployment_service_pb.js'

/**
 * Manages interface to Model Deployment Service
 */
export class DeploymentManager {
  /** The grpc stub */
  protected stub: services.DeploymentServiceClient
  /** Map from model type to deployment ids */
  protected modelTypeToDeployID: Map<common.TaskType, string>

  constructor (config: BotConfig) {
    const modelAddress = new URL(config.host)
    modelAddress.port = config.port.toString()

    this.stub = new services.DeploymentServiceClient(
      modelAddress.toString(), grpc.credentials.createInsecure()
    )
    this.modelTypeToDeployID = new Map()
  }

  /**
   * Completely set up and deploy the model
   */
  public async deployModel (taskType: common.TaskType) {
    if (this.modelTypeToDeployID.has(taskType)) {
      logger.info(`${taskType.toString()} model already deployed.`)
      return
    }

    let cdtResponse: messages.CreateDeploymentTaskResponse
    try {
      cdtResponse = await this.createDeploymentTask(taskType)
    } catch (e) {
      logger.error(e)
      return
    }
    const deployId = cdtResponse.getDeploymentTaskId()

    let deployResponse: messages.DeployResponse
    try {
      deployResponse = await this.finishDeployment(deployId)
    } catch (e) {
      logger.error(e)
      return
    }
    logger.info(`Successfully deployed ${taskType.toString()} model.`)
    this.modelTypeToDeployID.set(taskType, deployId)
  }

  /**
   * Run inference on a deployed model
   */
  public async infer (taskType: common.TaskType):
    Promise<messages.InferenceResponse> {
    const deployId = this.modelTypeToDeployID.get(taskType)
    if (!deployId) {
      return Promise.reject(
        Error(`${taskType.toString()} model not deployed.`))
    }
    const req = new messages.InferenceRequest()
    req.setProjectId('abcde12345')
    req.setDeploymentTaskId(deployId)
    req.setUrlListList(['https://datusagemaker.s3-us-west-2.amazonaws.com/toy/000000.png'])
    return new Promise((resolve, reject) => {
      this.stub.performInference(req, (
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
   * Initial set up to deploy a model
   */
  private async createDeploymentTask (taskType: common.TaskType):
    Promise<messages.CreateDeploymentTaskResponse> {
    const req = new messages.CreateDeploymentTaskRequest()
    req.setProjectId('abcde12345')
    req.setTaskType(taskType)

    return new Promise((resolve, reject) => {
      this.stub.createDeploymentTask(req,
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
   * Finish the deployment
   */
  private async finishDeployment (deployId: string):
    Promise<messages.DeployResponse>  {
    const req = new messages.DeployRequest()
    req.setProjectId('abcde12345')
    req.setNumGpus(1)
    req.setDeploymentTaskId(deployId)

    return new Promise((resolve, reject) => {
      this.stub.deployModel(req,
        (err: Error | null, result: messages.DeployResponse) => {
          if (err) {
            reject(err)
            return
          }
          resolve(result)
        })
    })
  }
}
