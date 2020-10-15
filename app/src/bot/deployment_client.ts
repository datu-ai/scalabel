import * as grpc from "grpc"
import logger from "../server/logger"
import { LabelExport } from "../types/export"
import { ModelType, QueryType } from "../types/bot"
import { BotConfig } from "../types/config"
import * as common from "./proto_gen/commons_pb.js"
import * as services from "./proto_gen/model_deployment_service_grpc_pb.js"
import * as messages from "./proto_gen/model_deployment_service_pb.js"
import { boxListToProto } from "./proto_utils"

/**
 * Create a new grpc stub connection
 *
 * @param config
 */
export function makeStub(
  config: BotConfig
): services.DeploymentServiceClient | null {
  const address = `${config.host}:${config.port}`
  logger.info(`Trying to connect to grpc server at ${address}`)
  try {
    const client = new services.DeploymentServiceClient(
      address,
      grpc.credentials.createInsecure()
    )
    return client
  } catch (e) {
    logger.error(e)
    return null
  }
}

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
  /** Map from query type to model type */
  protected queryTypeToModel: Map<QueryType, ModelType>
  /** An arbitrary project ID reserved for Scalabel */
  protected projectId: string

  /**
   * Constructor
   *
   * @param stub
   */
  constructor(stub: services.DeploymentServiceClient) {
    this.stub = stub
    this.modelTypeToDeployID = new Map()
    this.modelTypeToProto = new Map([
      [ModelType.INSTANCE_SEGMENTATION, common.TaskType.INSTANCE_SEGMENTATION],
      [ModelType.OBJECT_DETECTION_2D, common.TaskType.OBJECT_DETECTION_2D]
    ])

    this.queryTypeToModel = new Map([
      [QueryType.PREDICT_POLY, ModelType.INSTANCE_SEGMENTATION],
      [QueryType.REFINE_POLY, ModelType.INSTANCE_SEGMENTATION]
    ])

    this.projectId = "scalabelProjectId"
  }

  /**
   * Completely set up and deploy the model
   *
   * @param modelType
   */
  public async deployModel(modelType: ModelType): Promise<void> {
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
    let deployId = cdtResponse.getDeploymentTaskId()

    let deployResponse: messages.DeployResponse
    try {
      deployResponse = await this.finishDeployment(deployId)
    } catch (e) {
      logger.error(e)
      return
    }
    deployId = deployResponse.getDeploymentTaskId()
    logger.info(`Successfully deployed ${modelType.toString()} model.`)
    this.modelTypeToDeployID.set(modelType, deployId)
  }

  /**
   * Run inference on a deployed model
   *
   * @param queryType: the type of inference query
   * @param urlList: the list of image urls
   * @param labelLists: for each image, the list of labels
   * @param queryType
   * @param urlList
   * @param labelLists
   */
  public async infer(
    queryType: QueryType,
    urlList: string[],
    labelLists: LabelExport[][]
  ): Promise<messages.InferenceResponse> {
    const modelType = this.queryTypeToModel.get(queryType)
    if (modelType === undefined) {
      return await Promise.reject(
        Error(`${queryType.toString()} query not supported.`)
      )
    }

    const deployId = this.modelTypeToDeployID.get(modelType)
    if (deployId === undefined) {
      return await Promise.reject(
        Error(`${modelType.toString()} model not deployed.`)
      )
    }

    const req = new messages.InferenceRequest()
    req.setProjectId(this.projectId)
    req.setDeploymentTaskId(deployId)
    req.setUrlListList(urlList)
    const protoBoxList = labelLists.map((labelList) =>
      boxListToProto(labelList.map((label) => label.box2d))
    )
    req.setBoxListsList(protoBoxList)

    return new Promise((resolve, reject) => {
      this.stub.performInference(
        req,
        (err: Error | null, result: messages.InferenceResponse) => {
          if (err !== null) {
            return reject(err)
          }
          resolve(result)
        }
      )
    })
  }

  /**
   * Initial set up to deploy a model
   *
   * @param modelType
   */
  private async createDeploymentTask(
    modelType: ModelType
  ): Promise<messages.CreateDeploymentTaskResponse> {
    const taskType = this.modelTypeToProto.get(modelType)
    if (taskType === undefined) {
      return await Promise.reject(
        Error(`No proto mapping supplied for ${modelType} model.`)
      )
    }

    const req = new messages.CreateDeploymentTaskRequest()
    req.setProjectId(this.projectId)
    req.setTaskType(taskType)

    return await new Promise((resolve, reject) => {
      this.stub.createDeploymentTask(
        req,
        (err: Error | null, result: messages.CreateDeploymentTaskResponse) => {
          if (err !== null) {
            return reject(err)
          }
          resolve(result)
        }
      )
    })
  }

  /**
   * Finish the deployment
   *
   * @param deployId
   */
  private async finishDeployment(
    deployId: string
  ): Promise<messages.DeployResponse> {
    const req = new messages.DeployRequest()
    req.setProjectId(this.projectId)
    req.setNumGpus(1)
    req.setDeploymentTaskId(deployId)

    return await new Promise((resolve, reject) => {
      this.stub.deployModel(
        req,
        (err: Error | null, result: messages.DeployResponse) => {
          if (err !== null) {
            return reject(err)
          }
          resolve(result)
        }
      )
    })
  }
}
