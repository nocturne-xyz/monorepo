#!/usr/bin/env bash

COMMIT_HASH=$(git rev-parse --short HEAD)
docker push 714567495486.dkr.ecr.us-east-2.amazonaws.com/subtree-updater:$COMMIT_HASH