#!/bin/bash

# NOTE: Running this script assumes you have already deployed contracts to 
# Goerli and have set the below WALLET_CONTRACT_ADDRESS, VAULT_CONTRACT_ADDRESS 
# and START_BLOCK variables. It also assumes you have populated .env files in 
# packages/bundler, packages/subtree-updater, and have filled the snap submodule 
# RPC_URL constant with a Goerli endpoint.

# Goerli addresses
WALLET_CONTRACT_ADDRESS="0x57551a36C99528e4E19EA954C037d81c39fFdE4C"
VAULT_CONTRACT_ADDRESS="0x9122C4f180Cfc9392471ea9E3ab62B905DcBE6e1"
START_BLOCK=8412194

echo "Wallet contract address: $WALLET_CONTRACT_ADDRESS"
echo "Vault contract address: $VAULT_CONTRACT_ADDRESS"

# https://stackoverflow.com/questions/4774054/reliable-way-for-a-bash-script-to-get-the-full-path-to-itself
SCRIPT_DIR="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )" 
ROOT_DIR="$SCRIPT_DIR/../"
cd $ROOT_DIR

LOG_DIR="$ROOT_DIR/site-dev-logs"
mkdir -p $LOG_DIR

yarn build

# kill all child processes when this script exits
# trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT
trap 'trap - SIGTERM && kill 0' SIGINT SIGTERM EXIT

# start the site
pushd packages/site
yarn build
yarn start &
SITE_PID=$!
popd

# start the snap, we assume dev has hardcoded the snap RPC_URL to point to 
# correct network (so as to not expose API keys in this script)
pushd snap
yarn install
yarn build
yarn start &
SNAP_PID=$!
popd

sleep 3

# bundler default config variables
REDIS_URL="redis://redis:6379"
REDIS_PASSWORD="baka"
BUNDLER_PORT="3000"

# clear redis if it exists 
rm -r ./redis-data || "echo 'redis-data does not yet exist'"
popd

# run bundler
docker compose -f ./packages/bundler/docker-compose.yml --env-file packages/bundler/.env  up --build  &> "$LOG_DIR/bundler-docker-compose" &
BUNDLER_PID=$!

echo "Bundler running at PID: $BUNDLER_PID"

# run subtree updater
docker run --platform=linux/amd64 --env-file ./packages/subtree-updater/.env --add-host host.docker.internal:host-gateway docker.io/library/mock-subtree-updater --use-mock-prover --wallet-address "$WALLET_CONTRACT_ADDRESS" --zkey-path ./circuit-artifacts/subtreeupdate/subtreeupdate_cpp/subtreeupdate.zkey --vkey-path ./circuit-artifacts/subtreeupdate/subtreeupdate_cpp/vkey.json --prover-path /rapidsnark/build/prover --witness-generator-path ./circuit-artifacts/subtreeupdate/subtreeupdate_cpp/subtreeupdate --indexing-start-block 8393146 &> "$LOG_DIR/subtree-updater" &
SUBTREE_UPDATER_PID=$!

echo "Subtree updater running at PID: $SUBTREE_UPDATER_PID"

SNAP_INDEX_TS="$SCRIPT_DIR/../snap/src/index.ts"
SITE_TEST_PAGE="$SCRIPT_DIR/../packages/site/src/pages/index.tsx"
SITE_CONTRACT_CONFIG_TS="$SCRIPT_DIR/../packages/site/src/config/contracts.ts"

# Set snap wallet contract address
sed -i '' -r -e "s/const WALLET_ADDRESS = \"0x[0-9a-faA-F]+\";/const WALLET_ADDRESS = \"$WALLET_CONTRACT_ADDRESS\";/g" $SNAP_INDEX_TS
sed -i '' -r -e "s/const START_BLOCK = [0-9]*;/const START_BLOCK = ${START_BLOCK};/g" $SNAP_INDEX_TS

# Set site wallet and vault addresses
sed -i '' -r -e "s/export const WALLET_CONTRACT_ADDRESS = \"0x[0-9a-faA-F]+\";/export const WALLET_CONTRACT_ADDRESS = \"$WALLET_CONTRACT_ADDRESS\";/g" $SITE_CONTRACT_CONFIG_TS
sed -i '' -r -e "s/export const VAULT_CONTRACT_ADDRESS = \"0x[0-9a-faA-F]+\";/export const VAULT_CONTRACT_ADDRESS = \"$VAULT_CONTRACT_ADDRESS\";/g" $SITE_CONTRACT_CONFIG_TS

wait $SITE_PID
wait $SNAP_PID
wait $BUNDLER_PID
wait $HH_NODE_PID
wait $SUBTREE_UPDATER_PID