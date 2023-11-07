#!/usr/bin/env bash

SCRIPT_DIR="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
ROOT_DIR="$SCRIPT_DIR/../"
NETWORK_NAME=$1

if [ -z "$NETWORK_NAME" ]
then
	echo "no network name given"
	exit 1
else
	echo "building actor container for network '$NETWORK_NAME'"
fi

cd $ROOT_DIR

COMMIT_HASH=$(git rev-parse --short HEAD)

docker build -t nocturne-actors:$NETWORK_NAME-$COMMIT_HASH .
docker tag nocturne-actors:$NETWORK_NAME-$COMMIT_HASH 714567495486.dkr.ecr.us-east-2.amazonaws.com/nocturne-actors:$NETWORK_NAME-$COMMIT_HASH
