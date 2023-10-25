#!/usr/bin/env bash

SCRIPT_DIR="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
ROOT_DIR="$SCRIPT_DIR/../"

cd $ROOT_DIR

COMMIT_HASH=$(git rev-parse --short HEAD)

docker build -t nocturne-actors:$COMMIT_HASH .
docker tag nocturne-actors:$COMMIT_HASH 714567495486.dkr.ecr.us-east-2.amazonaws.com/nocturne-actors:$COMMIT_HASH
docker push 714567495486.dkr.ecr.us-east-2.amazonaws.com/nocturne-actors:$COMMIT_HASH