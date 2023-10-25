#!/usr/bin/env bash

SCRIPT_DIR="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
ROOT_DIR="$SCRIPT_DIR/../"

cd $ROOT_DIR

COMMIT_HASH=$(git rev-parse --short HEAD)

usage() { echo "usage: $0 [-p <'mock' | 'rapidsnark'>" 1>&2; }

while getopts ":p:o:" o; do
    case "${o}" in
        p)
            SUBTREE_UPDATER_PROVER_MODE=${OPTARG}
            ((SUBTREE_UPDATE_PROVER_MODE == "mock" || SUBTREE_UPDATE_PROVER_MODE == "rapidsnark")) || (usage && exit 1)
            ;;
        o)
            BUILD_ONLY=${OPTARG}
            ((BUILD_ONLY == "subtree-updater" || BUILD_ONLY == "bundler" || BUILD_ONLY == "deposit-screener" || BUILD_ONLY == "test-actor")) || (usage && exit 1)
            ;;
        *)
            SUBTREE_UPDATER_PROVER_MODE="mock"
            ;;
    esac
done

if [ "$SUBTREE_UPDATER_PROVER_MODE" == "rapidsnark" ]; then
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
else 
    docker build -f actors/subtree-updater/Mock.Dockerfile -t subtree-updater:$COMMIT_HASH .
fi

docker tag subtree-updater:$COMMIT_HASH 714567495486.dkr.ecr.us-east-2.amazonaws.com/subtree-updater:$COMMIT_HASH
docker push 714567495486.dkr.ecr.us-east-2.amazonaws.com/subtree-updater:$COMMIT_HASH