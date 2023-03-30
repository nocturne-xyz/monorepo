#!/bin/bash

pushd ./packages/subtree-updater
yarn build:mock:docker
popd 

pushd ./packages/bundler
yarn build:docker
popd

pushd ./packages/deposit-screener
yarn build:docker
popd
