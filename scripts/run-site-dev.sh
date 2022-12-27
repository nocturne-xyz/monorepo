#!/bin/bash

SCRIPT_DIR=$(dirname "$0")

yarn build
git submodule init
git submodule update --remote --force

# kill all child processes when this script exits
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

# start the hardhat node
pushd packages/e2e-tests
LOG_DIR="../../hh-logs"
mkdir -p $LOG_DIR
yarn hh-node &> "$LOG_DIR/hh-node" &
HH_NODE_PID=$!

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


sleep 1


sleep 3

# deposit
yarn hh-node-deposit &> "$LOG_DIR/hh-node-deposit" || { echo 'hh-node-deposit failed' ; exit 1; }

read WALLET_CONTRACT_ADDR < <(sed -nr 's/deploying "Wallet" \(tx: 0x[0-9a-fA-F]+\)\.\.\.: deployed at (0x[0-9a-fA-F]+) with [0-9]+ gas/\1/p' $LOG_DIR/hh-node)
read TOKEN_CONTRACT_ADDR < <(sed -nr 's/^Token deployed at:  (0x[a-fA-F0-9]{40})$/\1/p' $LOG_DIR/hh-node-deposit)
popd

echo "Wallet contract address: $WALLET_CONTRACT_ADDR"
echo "Token contract address: $TOKEN_CONTRACT_ADDR"

SNAP_INDEX_TS="$SCRIPT_DIR/../snap/src/index.ts"
SITE_OLD_INDEX_PAGE="$SCRIPT_DIR/../packages/site/src/pages/old-index.tsx"
SITE_UTILS="$SCRIPT_DIR/../packages/site/src/utils/metamask.ts"
sed -i '' -r -e "s/const WALLET_ADDRESS = \"0x[0-9a-faA-F]+\";/const WALLET_ADDRESS = \"$WALLET_CONTRACT_ADDR\";/g" $SNAP_INDEX_TS
sed -i '' -r -e "s/const tokenAddress = \"0x[0-9a-faA-F]+\";/const tokenAddress = \"$TOKEN_CONTRACT_ADDR\";/g" $SITE_OLD_INDEX_PAGE
sed -i '' -r -e "s/const WALLET_ADDRESS = \"0x[0-9a-faA-F]+\";/const WALLET_ADDRESS = \"$WALLET_CONTRACT_ADDR\";/g" $SITE_UTILS



wait $SITE_PID
wait $SNAP_PID
wait $HH_NODE_PID
