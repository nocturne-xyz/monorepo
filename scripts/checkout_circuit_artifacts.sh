#!/bin/bash

SCRIPT_DIR="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
ROOT_DIR="$SCRIPT_DIR/../"
NETWORK_NAME="$1"

if [ -z "$NETWORK_NAME" ]; then
    echo "No network name given"
    exit 1
else
    echo "Checking out circuit artifacts for network '$NETWORK_NAME'"
fi

CACHE_DIR="$ROOT_DIR/cache"
ARTIFACTS_DIR="$ROOT_DIR/circuit-artifacts"

# Check if the cache directory exists, create it if not
if [ ! -d "$CACHE_DIR" ]; then
    mkdir -p "$CACHE_DIR"
fi

CACHE_ENTRY="$CACHE_DIR/circuit-artifacts-$NETWORK_NAME"

# Check if the cache entry exists. if it doesn't, download artifacts into it
if [ ! -d "$CACHE_ENTRY" ]; then
    # Download artifacts from S3
    aws s3 cp "s3://actor-circuit-artifacts-$NETWORK_NAME/" "$CACHE_ENTRY" --recursive
fi

# Copy cached artifacts to the working directory
cp -r "$CACHE_ENTRY"/** "$ARTIFACTS_DIR"

