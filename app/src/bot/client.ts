import { DeploymentClient, ModelType } from './deployment_client'

/**
 * Set up and perform inference
 */
async function main () {
  const config = {
    on: true,
    host: '127.0.0.1',
    port: 52051
  }
  const manager = new DeploymentClient(config)
  await manager.deployModel(ModelType.OBJECT_DETECTION_2D)
  const res = await manager.infer(ModelType.OBJECT_DETECTION_2D)
  console.log(res.getDetectionResultList()[0].getDetectionsList())
}

main().then().catch((err: Error) => {
  console.log(err)
})
