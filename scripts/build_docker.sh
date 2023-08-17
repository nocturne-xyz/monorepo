#!/usr/bin/env bash

SCRIPT_DIR="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
ROOT_DIR="$SCRIPT_DIR/../"

cd $ROOT_DIR

COMMIT_HASH=$(git rev-parse --short HEAD)

# builds docker containers for offchain actors
# takes two options:
#   -p (optional): prover mode for subtree updater, 'mock' or 'rapidsnark'. If not given, defaults to 'mock'.
#   -o (optional): build only the indiciated actor. can be one of `subtree-updater`, `bundler`, `deposit-screener`, or `test-actor`

usage() { echo "usage: $0 [-p <'mock' | 'rapidsnark'> -o <'subtree-updater' | 'bundler' | 'deposit-screener' | 'test-actor'>]" 1>&2; }

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

build_subtree_updater() {
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
            echo "dected arm64, building for x86 using docker buildx..."

            docker buildx build --platform linux/amd64 -t rapidsnark ./rapidsnark
            docker buildx build -f actors/subtree-updater/Dockerfile --platform linux/amd64 -t nocturnelabs/subtree-updater:$COMMIT_HASH .
        else
            echo "deceting x86, building for x86 using docker build..."
            docker build -t rapidsnark ./rapidsnark
            docker build -f actors/subtree-updater/Dockerfile -t nocturnelabs/subtree-updater:$COMMIT_HASH .
        fi
    else 
        docker build -f actors/subtree-updater/Mock.Dockerfile -t nocturnelabs/subtree-updater:$COMMIT_HASH .
    fi
}


if [ "$BUILD_ONLY" == "subtree-updater" ]; then
    BUILD_SUBTREE_UPDATER=true
elif [ "$BUILD_ONLY" == "bundler" ]; then
    BUILD_BUNDLER=true
elif [ "$BUILD_ONLY" == "deposit-screener" ]; then
    BUILD_DEPOSIT_SCREENER=true
elif [ "$BUILD_ONLY" == "test-actor" ]; then
    BUILD_TEST_ACTOR=true
else
    BUILD_SUBTREE_UPDATER=true
    BUILD_BUNDLER=true
    BUILD_DEPOSIT_SCREENER=true
    BUILD_TEST_ACTOR=true
fi

# build subtree updater
if [ "$BUILD_SUBTREE_UPDATER" == "true" ]; then
    build_subtree_updater
else
    echo "skipping subtree updater..."
fi

# build bundler
if [ "$BUILD_BUNDLER" == "true" ]; then
    echo "building bundler..."
    docker build -f actors/bundler/Dockerfile -t nocturnelabs/bundler:$COMMIT_HASH .
else
    echo "skipping bundler..."
fi

# build deposit-screener
if [ "$BUILD_DEPOSIT_SCREENER" == "true" ]; then
    echo "building deposit-screener..."
    docker build -f actors/deposit-screener/Dockerfile -t nocturnelabs/deposit-screener:$COMMIT_HASH .
else
    echo "skipping deposit-screener..."
fi

# build test-actor
if [ "$BUILD_TEST_ACTOR" == "true" ]; then
    echo "building test-actor..." 
    docker build -f actors/test-actor/Dockerfile -t nocturnelabs/test-actor:$COMMIT_HASH .
else
    echo "skipping test-actor..."
fi
