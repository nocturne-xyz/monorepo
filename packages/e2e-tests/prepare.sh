#!/bin/bash
export $(cat ./.env | grep -v '#' | xargs)
pushd ./hardhat
docker build -t hardhat:latest .
popd