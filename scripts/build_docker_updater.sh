#!/usr/bin/env bash

SCRIPT_DIR="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
ROOT_DIR="$SCRIPT_DIR/../"

cd $ROOT_DIR

COMMIT_HASH=$(git rev-parse --short HEAD)

echo "building subtree updater with rapidsnark"

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

if [[ $(uname -m) == 'arm64' ]]; then
    echo "dected arm64, building for x86..."

    docker build --platform linux/amd64 -t rapidsnark ./rapidsnark
    docker buildx build --build-context circuit-artifacts=circuit-artifacts -f actors/subtree-updater/Dockerfile --platform linux/amd64 -t subtree-updater:$COMMIT_HASH .
else
    echo "deceting x86, building for x86..."
    docker build -t rapidsnark ./rapidsnark
    docker buildx build --build-context circuit-artifacts=circuit-artifacts -f actors/subtree-updater/Dockerfile -t subtree-updater:$COMMIT_HASH .
fi

docker tag subtree-updater:$COMMIT_HASH 714567495486.dkr.ecr.us-east-2.amazonaws.com/subtree-updater:$COMMIT_HASH
