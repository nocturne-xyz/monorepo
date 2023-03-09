#!/bin/bash

SCRIPT_DIR="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )" 
GRAPH_DIR="$SCRIPT_DIR/../../graph-node"

cd $GRAPH_DIR

if [[ $(uname -m) == 'arm64' ]]; then
	# Remove the original image
	docker rmi -f graphprotocol/graph-node:latest

	# Build the image
	./docker/build.sh

	# Tag the newly created image
	docker tag graph-node graphprotocol/graph-node:latest
fi
