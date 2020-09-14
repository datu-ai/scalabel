import * as grpc from 'grpc'
import logger from '../server/logger'
import { ModelType } from '../types/bot'
import { BotConfig } from '../types/config'
import * as common from './proto_gen/commons_pb.js'
import * as services from './proto_gen/model_deployment_service_grpc_pb.js'
import * as messages from './proto_gen/model_deployment_service_pb.js'

/**
 * Manages interface to Model Deployment Service
 */
export class DeploymentClient {
  /** The grpc stub */
  protected stub: services.DeploymentServiceClient
  /** Map from model type to deployment ids */
  protected modelTypeToDeployID: Map<ModelType, string>
  /** Map from model type to proto enum type */
  protected modelTypeToProto: Map<ModelType, common.TaskType>

  constructor (config: BotConfig) {
    this.stub = new services.DeploymentServiceClient(
      `${config.host}:${config.port}`, grpc.credentials.createInsecure()
    )
    this.modelTypeToDeployID = new Map()
    this.modelTypeToProto = new Map()
    this.modelTypeToProto.set(ModelType.INSTANCE_SEGMENTATION,
      common.TaskType.INSTANCE_SEGMENTATION)
    this.modelTypeToProto.set(ModelType.OBJECT_DETECTION_2D,
      common.TaskType.OBJECT_DETECTION_2D)
  }

  /**
   * Completely set up and deploy the model
   */
  public async deployModel (modelType: ModelType) {
    if (this.modelTypeToDeployID.has(modelType)) {
      logger.info(`${modelType.toString()} model already deployed.`)
      return
    }

    let cdtResponse: messages.CreateDeploymentTaskResponse
    try {
      cdtResponse = await this.createDeploymentTask(modelType)
    } catch (e) {
      logger.error(e)
      return
    }
    const deployId = cdtResponse.getDeploymentTaskId()

    try {
      await this.finishDeployment(deployId)
    } catch (e) {
      logger.error(e)
      return
    }
    logger.info(`Successfully deployed ${modelType.toString()} model.`)
    this.modelTypeToDeployID.set(modelType, deployId)
  }

  /**
   * Run inference on a deployed model
   */
  public async infer (modelType: ModelType):
    Promise<messages.InferenceResponse> {
    const deployId = this.modelTypeToDeployID.get(modelType)
    if (deployId === undefined) {
      return Promise.reject(
        Error(`${modelType.toString()} model not deployed.`))
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
  private async createDeploymentTask (modelType: ModelType):
    Promise<messages.CreateDeploymentTaskResponse> {
    const taskType = this.modelTypeToProto.get(modelType)
    if (taskType === undefined) {
      return Promise.reject(Error(`No proto mapping supplied for ${modelType} model.`))
    }

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
