#!/bin/bash

SCRIPT_DIR=$(dirname "$0")
ROOT_DIR="$SCRIPT_DIR/../../../"
CIRCUIT_NAME="subtreeupdate"
CIRCUIT_ARTIFACTS_DIR="$ROOT_DIR/circuit-artifacts/"

pushd "$CIRCUIT_ARTIFACTS_DIR"/"$CIRCUIT_NAME"/"$CIRCUIT_NAME"_cpp
make
popd
