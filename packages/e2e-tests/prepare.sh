#!/bin/bash
export $(cat ./.env | grep -v '#' | xargs)

pushd ../subtree-updater
yarn build:mock:docker
popd 

pushd ../bundler
yarn build:docker
popd

pushd ../deposit-screener
yarn build:docker
popd