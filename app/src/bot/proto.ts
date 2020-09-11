import * as protoLoader from '@grpc/proto-loader'
import * as grpc from 'grpc'

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
// Console.log(protoDescriptor)
// The protoDescriptor object has the full package hierarchy
const service = protoDescriptor.deployment_service.DeploymentService

const stub = new service(
  'localhost:52051', grpc.credentials.createInsecure())

// Const boxInput = [
//   {
//     box_lists: [
//       {
//         boxes: {
//           bottom_left: { x: 100, y: 100 },
//           top_right: { x: 200, y: 200 }
//         }
//       }
//     ]
//   }
// ]

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

async function main () {
  const res = await createTask(stub)
  let deployId = (res as any).deployment_task_id as string
  const res2 = await deployModel(stub, deployId)
  deployId = (res2 as any).deployment_task_id as string
  const res3 = await infer(stub, deployId)
  console.log((res3 as any).detection_result[0].detections)
}

main().then().catch((error: Error) => {
  console.log(error)
})

// Stub.createDeploymentTask({
//   project_id: 'abcde12345',
//   task_type: 0
// }, (err: any, result: any) => {
//   if (err) {
//     console.log(err)
//   } else {
//     stub.deployModel({
//       project_id: 'abcde12345',
//       num_gpus: 1,
//       deployment_task_id: result.deployment_task_id
//     }, (err2: any, result2: any) => {
//       if (err2) {
//         console.log(err2)
//       } else {
//         stub.performInference({
//           deployment_task_id: result2.deployment_task_id,
//           box_lists: boxInput,
//           url_list: ['https://datusagemaker.s3-us-west-2.amazonaws.com/toy/000000.png']
//         }, (err3: any, result3: any) => {
//           if (err3) {
//             console.log(err3)
//           } else {
//             console.log(result3.detection_result[0].detections)
//           }
//         })
//       }
//     })
//   }
// })

// Stub.performInference({
//   project_id: 'abc',
//   deployment_task_id: 'abc2',
//   image_list: [],
//   url_list: [],
//   box_lists: []
// }, (err: any, result: any) => {
//   if (err) {
//     console.log(err)
//   } else {
//     console.log(result)
//   }
// })
