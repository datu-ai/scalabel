#!/bin/sh
git submodule sync
git submodule update --init --remote

source_dir="./proto/protos/services"
gen_dir="./app/src/bot/proto_gen"

# generate js codes via grpc-tools
npx grpc_tools_node_protoc \
--js_out=import_style=commonjs,binary:$gen_dir \
--grpc_out=$gen_dir \
-I $source_dir \
$source_dir/*.proto

# generate d.ts codes
protoc \
--plugin=protoc-gen-ts=./node_modules/.bin/protoc-gen-ts \
--ts_out=$gen_dir \
-I $source_dir \
$source_dir/*.proto