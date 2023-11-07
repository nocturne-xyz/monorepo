#!/usr/bin/env bash

COMMIT_HASH=$(git rev-parse --short HEAD)
NETWORK_NAME=$1

if [ -z "$NETWORK_NAME" ]
then
	echo "no network name given"
	exit 1
else
	echo "pushing actor container for network '$NETWORK_NAME'"
fi

docker push 714567495486.dkr.ecr.us-east-2.amazonaws.com/nocturne-actors:$NETWORK_NAME-$COMMIT_HASH