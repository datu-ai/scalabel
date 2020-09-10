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
console.log(protoDescriptor)
// The protoDescriptor object has the full package hierarchy
const service = protoDescriptor.deployment_service.DeploymentService

const stub = new service(
  'localhost:50051', grpc.credentials.createInsecure())
stub.performInference({
  project_id: 'abc',
  deployment_task_id: 'abc2',
  image_list: [],
  url_list: [],
  box_lists: []
}, (err: any, result: any) => {
  if (err) {
    console.log(err)
  } else {
    console.log(result)
  }
})
