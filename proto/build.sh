# generate js codes via grpc-tools
npx grpc_tools_node_protoc \
--js_out=import_style=commonjs,binary:./app/src/bot/proto_gen \
--grpc_out=./app/src/bot/proto_gen \
-I ./proto \
./proto/*.proto

# generate d.ts codes
protoc \
--plugin=protoc-gen-ts=./node_modules/.bin/protoc-gen-ts \
--ts_out=./app/src/bot/proto_gen \
-I ./proto \
./proto/*.proto