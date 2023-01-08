#!/bin/bash

set -e

SCRIPT_DIR="$(dirname "$0")"
ROOT_DIR="SCRIPT_DIR/../../"

cd "$ROOT_DIR"
git submodule init
git submodule update

if [[ $(uname -m) == 'arm64' ]]; then
	echo "dected arm64, building using docker buildx..."

    docker buildx build --platform linux/amd64 -t rapidsnark ./rapidsnark

    docker buildx build --platform linux/amd64 -t subtree-updater -f ./packages/subtree-updater/Dockerfile .
else
	docker build -t rapidsnark ./rapidsnark
fi
