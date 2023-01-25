#!/bin/bash

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

# start the hardhat node
pushd packages/e2e-tests
echo "outputting logs to $LOG_DIR/"
yarn hh-node &> "$LOG_DIR/hh-node" &
HH_NODE_PID=$!

sleep 3

# deposit
echo "Running deposit funds script..."
yarn hh-node-deposit &> "$LOG_DIR/hh-node-deposit" || { echo 'hh-node-deposit failed' ; exit 1; }

read WALLET_ADDRESS < <(sed -nr 's/deploying "Wallet_Proxy" \(tx: 0x[0-9a-fA-F]+\)\.\.\.: deployed at (0x[0-9a-fA-F]+) with [0-9]+ gas/\1/p' $LOG_DIR/hh-node)
read TOKEN_CONTRACT_ADDR1 < <(sed -nr 's/^Token 1 deployed at: (0x[a-fA-F0-9]{40})$/\1/p' $LOG_DIR/hh-node-deposit)
read TOKEN_CONTRACT_ADDR2 < <(sed -nr 's/^Token 2 deployed at: (0x[a-fA-F0-9]{40})$/\1/p' $LOG_DIR/hh-node-deposit)
read BUNDLER_SUBMITTER_PRIVATE_KEY< <(grep -A1 "Account #15" $LOG_DIR/hh-node | grep "Private Key:" | sed -nr 's/Private Key: (0x[0-9a-fA-F]+)/\1/p')
read SUBTREE_UPDATER_SUBMITTER_PRIVATE_KEY< <(grep -A1 "Account #16" $LOG_DIR/hh-node | grep "Private Key:" | sed -nr 's/Private Key: (0x[0-9a-fA-F]+)/\1/p')
popd

REDIS_URL="redis://redis:6379"
REDIS_PASSWORD="baka"
RPC_URL="http://host.docker.internal:8545"
BUNDLER_PORT="3000"

echo "Wallet contract address: $WALLET_ADDRESS"
echo "Token contract addresses: $TOKEN_CONTRACT_ADDR1, $TOKEN_CONTRACT_ADDR2"
echo "Bundler submitter private key: $BUNDLER_SUBMITTER_PRIVATE_KEY"
echo "Subtree updater submitter private key: $SUBTREE_UPDATER_SUBMITTER_PRIVATE_KEY"

# write bundler's .env file
pushd packages/bundler
cat > .env <<- EOM
REDIS_URL="$REDIS_URL"
REDIS_PASSWORD="$REDIS_PASSWORD"

WALLET_ADDRESS="$WALLET_ADDRESS"

RPC_URL="$RPC_URL"
TX_SIGNER_KEY="$BUNDLER_SUBMITTER_PRIVATE_KEY"
EOM
popd

# run bundler
docker compose -f ./packages/bundler/docker-compose.yml --env-file packages/bundler/.env  up --build  &> "$LOG_DIR/bundler-docker-compose" &
BUNDLER_PID=$!

# write subtree updater's .env file
pushd packages/subtree-updater
cat > .env <<- EOM
SUBMITTER_SECRET_KEY=$SUBTREE_UPDATER_SUBMITTER_PRIVATE_KEY
EOM
popd

# run subtree updater
docker run --platform=linux/amd64 --env-file ./packages/subtree-updater/.env --add-host host.docker.internal:host-gateway docker.io/library/subtree-updater --wallet-address "$WALLET_ADDRESS" --zkey-path ./circuit-artifacts/subtreeupdate/subtreeupdate_cpp/subtreeupdate.zkey --vkey-path ./circuit-artifacts/subtreeupdate/subtreeupdate_cpp/vkey.json --prover-path /rapidsnark/build/prover --witness-generator-path ./circuit-artifacts/subtreeupdate/subtreeupdate_cpp/subtreeupdate --network http://host.docker.internal:8545 &> "$LOG_DIR/subtree-updater" &
SUBTREE_UPDATER_PID=$!

SNAP_INDEX_TS="$SCRIPT_DIR/../snap/src/index.ts"
SITE_TEST_PAGE="$SCRIPT_DIR/../packages/site/src/pages/index.tsx"

sed -i '' -r -e "s/const WALLET_ADDRESS = \"[0x]?[0-9a-faA-F]*\";/const WALLET_ADDRESS = \"$WALLET_ADDRESS\";/g" $SNAP_INDEX_TS
sed -i '' -r -e "s/const TOKEN_ADDRESS = \"[0x]?[0-9a-faA-F]*\";/const TOKEN_ADDRESS = \"$TOKEN_CONTRACT_ADDR1\";/g" $SITE_TEST_PAGE

wait $SITE_PID
wait $SNAP_PID
wait $BUNDLER_PID
wait $HH_NODE_PID
wait $SUBTREE_UPDATER_PID