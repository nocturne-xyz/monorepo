#!/bin/bash
export $(cat ./.env | grep -v '#' | xargs)
pushd ./hardhat
docker build -t hardhat .
popd

pushd ../subtree-updater
yarn build:mock:docker
popd 