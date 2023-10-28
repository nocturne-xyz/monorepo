#!/usr/bin/env bash

# NOTE: we run `hardhat verify` from the `contracts` package due to it having all the source code 
# and artifacts for the contracts. ETHERSCAN_API_KEY must be set in the contracts package .env file 
# for this script to work.
SCRIPT_DIR="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )" 
CONTRACTS_DIR="$SCRIPT_DIR/../../../../protocol/packages/contracts"
cd "$CONTRACTS_DIR"

cd "$CONTRACTS_DIR"
yarn verify:hardhat $1 $2 $3 $4 $5 $6 $7 $8 $9

cd "$SCRIPT_DIR"
