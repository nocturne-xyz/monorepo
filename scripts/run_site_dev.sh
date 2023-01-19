#!/bin/bash

SCRIPT_DIR=$(dirname "$0")
ROOT_DIR="$SCRIPT_DIR/../"
LOG_DIR="$SCRIPT_DIR/../site-dev-logs"
cd $ROOT_DIR

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

# start the hardhat node
pushd packages/e2e-tests
mkdir -p $LOG_DIR
yarn hh-node &> "$LOG_DIR/hh-node" &
HH_NODE_PID=$!

sleep 3

# deposit
echo "Running deposit funds script..."
yarn hh-node-deposit &> "$LOG_DIR/hh-node-deposit" || { echo 'hh-node-deposit failed' ; exit 1; }

read WALLET_ADDRESS < <(sed -nr 's/deploying "Wallet_Proxy" \(tx: 0x[0-9a-fA-F]+\)\.\.\.: deployed at (0x[0-9a-fA-F]+) with [0-9]+ gas/\1/p' $LOG_DIR/hh-node)
read TOKEN_CONTRACT_ADDR1 < <(sed -nr 's/^Token 1 deployed at: (0x[a-fA-F0-9]{40})$/\1/p' $LOG_DIR/hh-node-deposit)
read TOKEN_CONTRACT_ADDR2 < <(sed -nr 's/^Token 2 deployed at: (0x[a-fA-F0-9]{40})$/\1/p' $LOG_DIR/hh-node-deposit)
read SUBMITTER_PRIVATE_KEY< <(grep -A1 "Account #15" $LOG_DIR/hh-node | grep "Private Key:" | sed -nr 's/Private Key: (0x[0-9a-fA-F]+)/\1/p')
popd

REDIS_URL="redis://redis:6379"
REDIS_PASSWORD="baka"
RPC_URL="localhost:8545"
BUNDLER_PORT="3000"

echo "Wallet contract address: $WALLET_ADDRESS"
echo "Token contract addresses: $TOKEN_CONTRACT_ADDR1, $TOKEN_CONTRACT_ADDR2"
echo "Submitter private key: $SUBMITTER_PRIVATE_KEY"

# write bundler's .env file
pushd packages/bundler
cat > .env <<- EOM
REDIS_URL="$REDIS_URL"
REDIS_PASSWORD="$REDIS_PASSWORD"

WALLET_ADDRESS="$WALLET_ADDRESS"

RPC_URL="$RPC_URL"
TX_SIGNER_KEY="$SUBMITTER_PRIVATE_KEY"
EOM
popd

# run bundler
docker compose -f ./packages/bundler/docker-compose.yml --env-file packages/bundler/.env  up --build  &> "$LOG_DIR/bundler-docker-compose" &
BUNDLER_PID=$!

SNAP_INDEX_TS="$SCRIPT_DIR/../snap/src/index.ts"
SITE_TEST_PAGE="$SCRIPT_DIR/../packages/site/src/pages/index.tsx"

sed -i '' -r -e "s/const WALLET_ADDRESS = \"0x[0-9a-faA-F]+\";/const WALLET_ADDRESS = \"$WALLET_ADDRESS \";/g" $SNAP_INDEX_TS

sed -i '' -r -e "s/const TOKEN_ADDRESS = \"0x[0-9a-faA-F]+\";/const TOKEN_ADDRESS = \"$TOKEN_CONTRACT_ADDR1\";/g" $SITE_TEST_PAGE

wait $SITE_PID
wait $SNAP_PID
wait $BUNDLER_PID
wait $HH_NODE_PID
