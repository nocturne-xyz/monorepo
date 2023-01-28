#!/bin/bash

# Goerli addresses
WALLET_CONTRACT_ADDRESS="0xb958051f2b6E0C49B430A924830F511f079610E7"
VAULT_CONTRACT_ADDRESS="0x46B8545D6Ec6D0abC212e6845B7d0b1c665417bc"

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

# start the snap
pushd snap
yarn install
yarn build
yarn start &
SNAP_PID=$!
popd

sleep 3

read BUNDLER_SUBMITTER_PRIVATE_KEY< <(grep -A1 "Account #15" $LOG_DIR/hh-node | grep "Private Key:" | sed -nr 's/Private Key: (0x[0-9a-fA-F]+)/\1/p')
read SUBTREE_UPDATER_SUBMITTER_PRIVATE_KEY< <(grep -A1 "Account #16" $LOG_DIR/hh-node | grep "Private Key:" | sed -nr 's/Private Key: (0x[0-9a-fA-F]+)/\1/p')
popd

# bundler default config variables
REDIS_URL="redis://redis:6379"
REDIS_PASSWORD="baka"
RPC_URL="http://host.docker.internal:8545"
BUNDLER_PORT="3000"

# clear redis if it exists 
rm -r ./redis-data || "echo 'redis-data does not yet exist'"
popd

# run bundler
docker compose -f ./packages/bundler/docker-compose.yml --env-file packages/bundler/.env  up --build  &> "$LOG_DIR/bundler-docker-compose" &
BUNDLER_PID=$!

echo "Bundler running at PID: $BUNDLER_PID"

# run subtree updater
docker run --platform=linux/amd64 --env-file ./packages/subtree-updater/.env --add-host host.docker.internal:host-gateway docker.io/library/mock-subtree-updater --use-mock-prover --wallet-address "$WALLET_CONTRACT_ADDRESS" --zkey-path ./circuit-artifacts/subtreeupdate/subtreeupdate_cpp/subtreeupdate.zkey --vkey-path ./circuit-artifacts/subtreeupdate/subtreeupdate_cpp/vkey.json --prover-path /rapidsnark/build/prover --witness-generator-path ./circuit-artifacts/subtreeupdate/subtreeupdate_cpp/subtreeupdate --network http://host.docker.internal:8545 &> "$LOG_DIR/subtree-updater" &
SUBTREE_UPDATER_PID=$!

echo "Subtree updater running at PID: $SUBTREE_UPDATER_PID"

SNAP_INDEX_TS="$SCRIPT_DIR/../snap/src/index.ts"
SITE_TEST_PAGE="$SCRIPT_DIR/../packages/site/src/pages/index.tsx"
SITE_CONTRACT_CONFIG_TS="$SCRIPT_DIR/../packages/site/src/config/contracts.ts"

# Set snap wallet contract address
sed -i '' -r -e "s/const WALLET_ADDRESS = \"0x[0-9a-faA-F]+\";/const WALLET_ADDRESS = \"$WALLET_CONTRACT_ADDRESS\";/g" $SNAP_INDEX_TS

# Set site wallet and vault addresses
sed -i '' -r -e "s/export const WALLET_CONTRACT_ADDRESS = \"0x[0-9a-faA-F]+\";/export const WALLET_CONTRACT_ADDRESS = \"$WALLET_CONTRACT_ADDRESS\";/g" $SITE_CONTRACT_CONFIG_TS
sed -i '' -r -e "s/export const VAULT_CONTRACT_ADDRESS = \"0x[0-9a-faA-F]+\";/export const VAULT_CONTRACT_ADDRESS = \"$VAULT_CONTRACT_ADDRESS\";/g" $SITE_CONTRACT_CONFIG_TS

wait $SITE_PID
wait $SNAP_PID
wait $BUNDLER_PID
wait $HH_NODE_PID
wait $SUBTREE_UPDATER_PID