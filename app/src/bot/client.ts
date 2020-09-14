import { DeploymentManager } from './deployment_manager.js'
import * as common from './proto_gen/commons_pb.js'

/**
 * Set up and perform inference
 */
async function main () {
  const config = {
    on: true,
    host: 'localhost',
    port: 52051
  }
  const manager = new DeploymentManager(config)
  await manager.deployModel(common.TaskType.OBJECT_DETECTION_2D)
  const res = await manager.infer(common.TaskType.OBJECT_DETECTION_2D)
  console.log(res.getDetectionResultList()[0].getDetectionsList())
}

main().then().catch((err: Error) => {
  console.log(err)
})
