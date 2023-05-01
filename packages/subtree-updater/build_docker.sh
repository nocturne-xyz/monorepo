#!/bin/bash

set -e

SCRIPT_DIR="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )" 
ROOT_DIR="$SCRIPT_DIR/../../"

cd "$ROOT_DIR"

pushd rapidsnark
git submodule init
git submodule update
popd

if [ ! -d "$ROOT_DIR/circuit-artifacts/subtreeupdate/" ]; then
    pushd packages/circuits
    yarn download-big-ptau
    yarn build:subtreeupdate
    yarn local-prover:gen-test-cases
    popd
fi

if [ ! -z "$IS_MOCK" ]; then
    echo "building mock subtree-updater"
    docker build -t nocturnexyz/mock-subtree-updater:dev -f ./packages/subtree-updater/Mock.Dockerfile .
    exit 0
fi

echo "building subtree updater with rapidsnark"
if [[ $(uname -m) == 'arm64' ]]; then
	echo "dected arm64, building for x86 using docker buildx..."

    docker buildx build --platform linux/amd64 -t rapidsnark ./rapidsnark
    docker buildx build --platform linux/amd64 -t nocturnexyz/subtree-updater:dev -f ./packages/subtree-updater/Dockerfile .
else
    echo 
    docker build -t rapidsnark ./rapidsnark
    docker build -t nocturnexyz/subtree-updater:dev -f ./packages/subtree-updater/Dockerfile .
fi
