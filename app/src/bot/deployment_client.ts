import * as grpc from 'grpc'
import logger from '../server/logger'
import { Box2DType, LabelExport } from '../types/bdd'
import { ModelType, QueryType } from '../types/bot'
import { BotConfig } from '../types/config'
import * as common from './proto_gen/commons_pb.js'
import * as services from './proto_gen/model_deployment_service_grpc_pb.js'
import * as messages from './proto_gen/model_deployment_service_pb.js'

/**
 * Convert a box list in BDD format to a proto
 */
function boxListToProto (boxList: Array<Box2DType | null>): messages.BoxList {
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
export function parseInstanceSegmentationRes (
  resp: messages.InstanceSegmentationResult): number[][][] {
  const polygons: number[][][] = []
  resp.getPolygonsList().forEach((protoPoly) => {
    const polygon: number[][] = []
    protoPoly.getPointsList().forEach((protoPoint) => {
      polygon.push([protoPoint.getX(), protoPoint.getY()])
    })
    polygons.push(polygon)
  })
  return polygons
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

    this.queryTypeToModel = new Map()
    this.queryTypeToModel.set(
      QueryType.PREDICT_POLY, ModelType.INSTANCE_SEGMENTATION)
    this.queryTypeToModel.set(
      QueryType.REFINE_POLY, ModelType.INSTANCE_SEGMENTATION
    )
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
  public async infer (
    queryType: QueryType, urlList: string[],
    labelLists: LabelExport[][]):
    Promise<messages.InferenceResponse> {
    const modelType = this.queryTypeToModel.get(queryType)
    if (modelType === undefined) {
      return Promise.reject(
        Error(`${queryType.toString()} query not supported.`)
      )
    }
    const deployId = this.modelTypeToDeployID.get(modelType)
    if (deployId === undefined) {
      return Promise.reject(
        Error(`${modelType.toString()} model not deployed.`))
    }
    const req = new messages.InferenceRequest()
    req.setProjectId('abcde12345')
    req.setDeploymentTaskId(deployId)
    req.setUrlListList(urlList)
    const protoBoxList = labelLists.map((labelList) => boxListToProto(
      labelList.map((label) => label.box2d)
    ))
    req.setBoxListsList(protoBoxList)
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
