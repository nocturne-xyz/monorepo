#!/bin/bash

set -e

SCRIPT_DIR="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )" 
ROOT_DIR="$SCRIPT_DIR/../../"

cd "$ROOT_DIR"

echo "building mock subtree-updater"
docker build -t mock-subtree-updater -f ./packages/subtree-updater/Mock.Dockerfile .