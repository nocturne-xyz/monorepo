#!/bin/bash

# builds docker containers for offchain actors
# takes two options:
#   -p (optional): prover mode for subtree updater, 'mock' or 'rapidsnark'. If not given, defaults to 'mock'.

usage() { echo "usage: $0 [-p <'mock' | 'rapidsnark'>]" 1>&2; }

while getopts ":p:" o; do
    case "${o}" in
        p)
            SUBTREE_UPDATER_PROVER_MODE=${OPTARG}
            ((SUBTREE_UPDATE_PROVER_MODE == "mock" || SUBTREE_UPDATE_PROVER_MODE == "rapidsnark")) || (usage && exit 1)
            ;;
        *)
            SUBTREE_UPDATER_PROVER_MODE="mock"
            ;;
    esac
done

pushd ./packages/subtree-updater

if [ "$SUBTREE_UPDATER_PROVER_MODE" == "rapidsnark" ]; then
    yarn build:docker
else 
    yarn build:mock:docker
fi

popd 

pushd ./packages/bundler
yarn build:docker
popd

pushd ./packages/deposit-screener
yarn build:docker
popd
