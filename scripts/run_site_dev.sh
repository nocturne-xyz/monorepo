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

# deposit
echo "Running deposit funds script..."
yarn hh-node-deposit &> "$LOG_DIR/hh-node-deposit" || { echo 'hh-node-deposit failed' ; exit 1; }

START_BLOCK=0
BUNDLER_TX_SIGNER_KEY="0x0000000000000000000000000000000000000000000000000000000000000004"
SUBTREE_UPDATER_TX_SIGNER_KEY="0x0000000000000000000000000000000000000000000000000000000000000005"

# read config variables from logs
read WALLET_CONTRACT_ADDRESS < <(sed -nr 's/^Wallet address: (0x[a-fA-F0-9]{40})$/\1/p' $LOG_DIR/hh-node-deposit)
read VAULT_CONTRACT_ADDRESS < <(sed -nr 's/^Vault address: (0x[a-fA-F0-9]{40})$/\1/p' $LOG_DIR/hh-node-deposit)
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
REDIS_URL="redis://redis:6379"
REDIS_PASSWORD="baka"
RPC_URL="http://host.docker.internal:8545"
BUNDLER_PORT="3000"

echo "Wallet contract address: $WALLET_CONTRACT_ADDRESS"
echo "Vault contract address: $VAULT_CONTRACT_ADDRESS"
echo "Token contract addresses: $TOKEN_CONTRACT_ADDR1, $TOKEN_CONTRACT_ADDR2"
echo "Bundler submitter private key: $BUNDLER_TX_SIGNER_KEY"
echo "Subtree updater submitter private key: $SUBTREE_UPDATER_TX_SIGNER_KEY"

# write bundler's .env file
pushd packages/bundler
cat > .env <<- EOM
REDIS_URL=$REDIS_URL
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
docker compose -f ./packages/bundler/docker-compose.yml --env-file packages/bundler/.env  up --build  &> "$LOG_DIR/bundler-docker-compose" &
BUNDLER_PID=$!

echo "Bundler running at PID: $BUNDLER_PID"

# write subtree updater's .env file
pushd packages/subtree-updater
cat > .env <<- EOM
RPC_URL=$RPC_URL
TX_SIGNER_KEY=$SUBTREE_UPDATER_TX_SIGNER_KEY
EOM
popd

# run subtree updater
docker run --env-file ./packages/subtree-updater/.env --add-host host.docker.internal:host-gateway docker.io/library/mock-subtree-updater --use-mock-prover --fill-batches --wallet-address "$WALLET_CONTRACT_ADDRESS" --zkey-path ./circuit-artifacts/subtreeupdate/subtreeupdate_cpp/subtreeupdate.zkey --vkey-path ./circuit-artifacts/subtreeupdate/subtreeupdate_cpp/vkey.json --prover-path /rapidsnark/build/prover --witness-generator-path ./circuit-artifacts/subtreeupdate/subtreeupdate_cpp/subtreeupdate &> "$LOG_DIR/subtree-updater" &
SUBTREE_UPDATER_PID=$!

echo "Subtree updater running at PID: $SUBTREE_UPDATER_PID"

SNAP_INDEX_TS="$SCRIPT_DIR/../packages/snap/src/index.ts"
SITE_TEST_PAGE="$SCRIPT_DIR/../packages/site/src/pages/index.tsx"
SITE_CONTRACT_CONFIG_TS="$SCRIPT_DIR/../packages/site/src/config/contracts.ts"

# Set snap wallet contract address
sed -i '' -r -e "s/const WALLET_ADDRESS = \"0x[0-9a-faA-F]+\";/const WALLET_ADDRESS = \"$WALLET_CONTRACT_ADDRESS\";/g" $SNAP_INDEX_TS
sed -i '' -r -e "s/const START_BLOCK = [0-9]*;/const START_BLOCK = ${START_BLOCK};/g" $SNAP_INDEX_TS


# Set site wallet and vault addresses
sed -i '' -r -e "s/export const WALLET_CONTRACT_ADDRESS = \"0x[0-9a-faA-F]+\";/export const WALLET_CONTRACT_ADDRESS = \"$WALLET_CONTRACT_ADDRESS\";/g" $SITE_CONTRACT_CONFIG_TS
sed -i '' -r -e "s/export const VAULT_CONTRACT_ADDRESS = \"0x[0-9a-faA-F]+\";/export const VAULT_CONTRACT_ADDRESS = \"$VAULT_CONTRACT_ADDRESS\";/g" $SITE_CONTRACT_CONFIG_TS

# Set test site token address
sed -i '' -r -e "s/const TOKEN_ADDRESS = \"0x[0-9a-faA-F]+\";/const TOKEN_ADDRESS = \"$TOKEN_CONTRACT_ADDR1\";/g" $SITE_TEST_PAGE

wait $SITE_PID
wait $SNAP_PID
wait $BUNDLER_PID
wait $HH_NODE_PID
wait $SUBTREE_UPDATER_PID
