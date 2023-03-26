#!/bin/bash

# https://stackoverflow.com/questions/4774054/reliable-way-for-a-bash-script-to-get-the-full-path-to-itself
SCRIPT_DIR="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )" 
ROOT_DIR="$SCRIPT_DIR/../"
cd $ROOT_DIR

LOG_DIR="$ROOT_DIR/site-dev-logs"
mkdir -p $LOG_DIR
echo "outputting logs to $LOG_DIR/"

yarn build

# kill all child processes when this script exits
# trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT
trap 'trap - SIGTERM && kill 0' SIGINT SIGTERM EXIT

# start the site
pushd packages/site
echo "starting site..."
yarn start &
SITE_PID=$!
popd

# start the snap
pushd packages/snap
echo "starting snap..."
yarn start &
SNAP_PID=$!
popd

# start the hardhat node
pushd packages/e2e-tests
echo "starting hardhat node..."
yarn hh-node &> "$LOG_DIR/hh-node" &
HH_NODE_PID=$!

sleep 10

# start graph node
echo "starting graph node..."
yarn graph-node &> "$LOG_DIR/graph-node" &

START_BLOCK=0
BUNDLER_TX_SIGNER_KEY="0x0000000000000000000000000000000000000000000000000000000000000004"
SUBTREE_UPDATER_TX_SIGNER_KEY="0x0000000000000000000000000000000000000000000000000000000000000005"
# ran the following script to get this:
# import { ethers } from "ethers";
# const sk = "0x0000000000000000000000000000000000000000000000000000000000000005";
# const signer = new ethers.Wallet(sk)
# console.log(signer.address);
SUBTREE_UPDATER_ADDRESS="0xe1AB8145F7E55DC933d51a18c793F901A3A0b276"

# Eth address: 0xE57bFE9F44b819898F47BF37E5AF72a0783e1141
SCREENER_TX_SIGNER_KEY="0x0000000000000000000000000000000000000000000000000000000000000006"

# deposit
echo "Running deposit funds script..."
yarn hh-node-deposit &> "$LOG_DIR/hh-node-deposit" || { echo 'hh-node-deposit failed' ; exit 1; }

# read config variables from logs
read DEPOSIT_MANAGER_CONTRACT_ADDRESS < <(sed -nr 's/^DepositManager address: (0x[a-fA-F0-9]{40})$/\1/p' $LOG_DIR/hh-node-deposit)
read WALLET_CONTRACT_ADDRESS < <(sed -nr 's/^Wallet address: (0x[a-fA-F0-9]{40})$/\1/p' $LOG_DIR/hh-node-deposit)
read HANDLER_CONTRACT_ADDRESS < <(sed -nr 's/^Handler address: (0x[a-fA-F0-9]{40})$/\1/p' $LOG_DIR/hh-node-deposit)
read TOKEN_CONTRACT_ADDR1 < <(sed -nr 's/^Token 1 deployed at: (0x[a-fA-F0-9]{40})$/\1/p' $LOG_DIR/hh-node-deposit)
read TOKEN_CONTRACT_ADDR2 < <(sed -nr 's/^Token 2 deployed at: (0x[a-fA-F0-9]{40})$/\1/p' $LOG_DIR/hh-node-deposit)
popd

sleep 20

# deploy subgraph
pushd packages/subgraph
yarn create-local
yarn deploy-local
popd

# bundler default config variables
BUNDLER_REDIS_URL="redis://redis:6379"
REDIS_PASSWORD="baka"
RPC_URL="http://host.docker.internal:8545"
BUNDLER_PORT="3000"

# screener default config variables
SCREENER_REDIS_URL="redis://redis:6380"
SUBGRAPH_URL="http://host.docker.internal:8000/subgraphs/name/nocturne-test"

echo "DepositManager contract address: $DEPOSIT_MANAGER_CONTRACT_ADDRESS"
echo "Wallet contract address: $WALLET_CONTRACT_ADDRESS"
echo "Handler contract address: $HANDLER_CONTRACT_ADDRESS"
echo "Token contract addresses: $TOKEN_CONTRACT_ADDR1, $TOKEN_CONTRACT_ADDR2"
echo "Bundler submitter private key: $BUNDLER_TX_SIGNER_KEY"
echo "Subtree updater submitter private key: $SUBTREE_UPDATER_TX_SIGNER_KEY"

# write bundler's .env file
pushd packages/bundler
cat > .env <<- EOM
REDIS_URL=$BUNDLER_REDIS_URL
REDIS_PASSWORD=$REDIS_PASSWORD

WALLET_ADDRESS=$WALLET_CONTRACT_ADDRESS
MAX_LATENCY=5

RPC_URL=$RPC_URL
TX_SIGNER_KEY=$BUNDLER_TX_SIGNER_KEY
EOM

# clear redis if it exists 
rm -r ./redis-data || echo 'redis-data does not yet exist'
mkdir ./redis-data
popd

# run bundler
docker compose -f ./packages/bundler/docker-compose.yml --env-file packages/bundler/.env up --build &> "$LOG_DIR/bundler-docker-compose" &
BUNDLER_PID=$!

echo "Bundler running at PID: $BUNDLER_PID"

# write screener's .env file
pushd packages/deposit-screener
cat > .env <<- EOM
REDIS_URL=$SCREENER_REDIS_URL
REDIS_PASSWORD=$REDIS_PASSWORD

DEPOSIT_MANAGER_ADDRESS=$DEPOSIT_MANAGER_CONTRACT_ADDRESS
SUBGRAPH_URL=$SUBGRAPH_URL
RPC_URL=$RPC_URL

TX_SIGNER_KEY=$SCREENER_TX_SIGNER_KEY
ATTESTATION_SIGNER_KEY=$SCREENER_TX_SIGNER_KEY
EOM

# clear redis if it exists 
rm -r ./redis-data || echo 'redis-data does not yet exist'
mkdir ./redis-data
popd

# run screener
docker compose -f ./packages/deposit-screener/docker-compose.yml --env-file packages/deposit-screener/.env up --build  &> "$LOG_DIR/screener-docker-compose" &
SCREENER_PID=$!

echo "Screener running at PID: $SCREENER_PID"

# write subtree updater's .env file
pushd packages/subtree-updater
cat > .env <<- EOM
RPC_URL=$RPC_URL
TX_SIGNER_KEY=$SUBTREE_UPDATER_TX_SIGNER_KEY
EOM
popd

# run subtree updater
docker run --env-file ./packages/subtree-updater/.env --add-host host.docker.internal:host-gateway docker.io/library/mock-subtree-updater --use-mock-prover --fill-batches --handler-address "$HANDLER_CONTRACT_ADDRESS" --zkey-path ./circuit-artifacts/subtreeupdate/subtreeupdate_cpp/subtreeupdate.zkey --vkey-path ./circuit-artifacts/subtreeupdate/subtreeupdate_cpp/vkey.json --prover-path /rapidsnark/build/prover --witness-generator-path ./circuit-artifacts/subtreeupdate/subtreeupdate_cpp/subtreeupdate &> "$LOG_DIR/subtree-updater" &
SUBTREE_UPDATER_PID=$!

echo "Subtree updater running at PID: $SUBTREE_UPDATER_PID"

SNAP_INDEX_TS="$SCRIPT_DIR/../packages/snap/src/index.ts"
SITE_TEST_PAGE="$SCRIPT_DIR/../packages/site/src/pages/index.tsx"
SITE_CONTRACT_CONFIG_TS="$SCRIPT_DIR/../packages/site/src/config/contracts.ts"

# Set snap handler contract address
sed -i '' -r -e "s/const HANDLER_ADDRESS = \"0x[0-9a-faA-F]+\";/const HANDLER_ADDRESS = \"$HANDLER_CONTRACT_ADDRESS\";/g" $SNAP_INDEX_TS
sed -i '' -r -e "s/const START_BLOCK = [0-9]*;/const START_BLOCK = ${START_BLOCK};/g" $SNAP_INDEX_TS

# Set snap gas token addresses
sed -i '' -r -e "s/const GAS_TOKEN1 = \"0x[0-9a-faA-F]+\";/const GAS_TOKEN1 = \"$TOKEN_CONTRACT_ADDR1\";/g" $SNAP_INDEX_TS
sed -i '' -r -e "s/const GAS_TOKEN2 = \"0x[0-9a-faA-F]+\";/const GAS_TOKEN2 = \"$TOKEN_CONTRACT_ADDR2\";/g" $SNAP_INDEX_TS

# Set site wallet address
sed -i '' -r -e "s/export const WALLET_CONTRACT_ADDRESS = \"0x[0-9a-faA-F]+\";/export const WALLET_CONTRACT_ADDRESS = \"$WALLET_CONTRACT_ADDRESS\";/g" $SITE_CONTRACT_CONFIG_TS

# Set test site token address
sed -i '' -r -e "s/const TOKEN_ADDRESS = \"0x[0-9a-faA-F]+\";/const TOKEN_ADDRESS = \"$TOKEN_CONTRACT_ADDR1\";/g" $SITE_TEST_PAGE


wait $SITE_PID
wait $SNAP_PID
wait $BUNDLER_PID
wait $SCREENER_PID
wait $HH_NODE_PID
wait $SUBTREE_UPDATER_PID
