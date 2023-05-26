#!/bin/bash

cleanup() {
    echo "SIGINT signal caught, cleaning up..."
    docker stop $(docker ps -aq)
    docker rm $(docker ps -aq)
    echo "——————————————————————————————"
    echo "Done 🧹🧹🧹"
    exit
}

# Calls cleanup() upon CTRL+C or early exit
trap cleanup SIGINT SIGTERM EXIT

# https://stackoverflow.com/questions/4774054/reliable-way-for-a-bash-script-to-get-the-full-path-to-itself
SCRIPT_DIR="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )" 
ROOT_DIR="$SCRIPT_DIR/../"
cd $ROOT_DIR

LOG_DIR="$ROOT_DIR/site-dev-logs"

pre_startup() {
    echo "Preparing environment..."
    if ! docker info > /dev/null 2>&1; then
    echo "Docker is not running; please start it then retry. Exiting."
    exit 1
    fi
    # Clean up any old or lurking docker containers
    echo "Cleaning up lurking docker containers..."
    docker stop $(docker ps -aq)
    docker rm $(docker ps -aq)
    # Clean up old logs, if they exists
    echo "Cleaning up old logs..."
    rm -rf $LOG_DIR
    rm -rf $ROOT_DIR/logs

}

pre_startup

mkdir -p $LOG_DIR
mkdir -p $ROOT_DIR/logs
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

# wait a bit for site to finish building
# this is to avoid gatsby throwing a fit because we have stuff running on the
# same ports its dumb graphql server wants to use
sleep 20

# start hardhat 
pushd packages/e2e-tests
echo "starting hardhat..."
npx hardhat node &> "$LOG_DIR/hardhat" &
HARDHAT_PID=$!

sleep 1

# start graph node
echo "starting graph node..."
yarn graph-node &> "$LOG_DIR/graph-node" &
GRAPH_NODE_PID=$!

# deposit
echo "Running deposit funds script..."
yarn hardhat-deposit &> "$LOG_DIR/hardhat-deposit" || { echo 'hardhat-deposit failed' ; exit 1; }

START_BLOCK=0

# hardhat account #4
# eth address: 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65
BUNDLER_TX_SIGNER_KEY="0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a"

# hardhat account #5
# eth address: 0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc
SUBTREE_UPDATER_TX_SIGNER_KEY="0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba"

# hardhat account #6
# eth address: 0x976EA74026E726554dB657fA54763abd0C3a0aa9
SCREENER_TX_SIGNER_KEY="0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e"

# read config variables from logs
read DEPOSIT_MANAGER_CONTRACT_ADDRESS < <(sed -nr 's/^DepositManager address: (0x[a-fA-F0-9]{40})$/\1/p' $LOG_DIR/hardhat-deposit)
read TELLER_CONTRACT_ADDRESS < <(sed -nr 's/^Teller address: (0x[a-fA-F0-9]{40})$/\1/p' $LOG_DIR/hardhat-deposit)
read HANDLER_CONTRACT_ADDRESS< <(sed -nr 's/^Handler address: (0x[a-fA-F0-9]{40})$/\1/p' $LOG_DIR/hardhat-deposit)
read TOKEN_CONTRACT_ADDR1 < <(sed -nr 's/^ERC20 token 1 deployed at: (0x[a-fA-F0-9]{40})$/\1/p' $LOG_DIR/hardhat-deposit)
read TOKEN_CONTRACT_ADDR2 < <(sed -nr 's/^ERC20 token 2 deployed at: (0x[a-fA-F0-9]{40})$/\1/p' $LOG_DIR/hardhat-deposit)
read GAS_TOKEN_CONTRACT_ADDR < <(sed -nr 's/^Gas token deployed at: (0x[a-fA-F0-9]{40})$/\1/p' $LOG_DIR/hardhat-deposit)
popd

sleep 10

# re-build now that config package has updated localhost.json
echo "rebuilding config post-deploy..."
pushd packages/config
yarn clean
yarn build
popd

sleep 15

# deploy subgraph
pushd packages/subgraph
yarn create-local
yarn deploy-local
popd

# start the snap
pushd packages/snap
echo "starting snap..."
yarn build
sleep 10
yarn start &
SNAP_PID=$!
popd

# bundler default config variables
BUNDLER_REDIS_URL="redis://redis:6379"
REDIS_PASSWORD="baka"
RPC_URL="http://host.docker.internal:8545"
BUNDLER_PORT="3000"

# screener default config variables
SCREENER_REDIS_URL="redis://redis:6380"

# subtree updater default config variables 
SUBTREE_UPDATER_REDIS_URL="redis://redis:6381"

# subgraph url
SUBGRAPH_URL="http://host.docker.internal:8000/subgraphs/name/nocturne"

echo "DepositManager contract address: $DEPOSIT_MANAGER_CONTRACT_ADDRESS"
echo "Teller contract address: $TELLER_CONTRACT_ADDRESS"
echo "Handler contract address: $HANDLER_CONTRACT_ADDRESS"
echo "Token contract addresses: $TOKEN_CONTRACT_ADDR1, $TOKEN_CONTRACT_ADDR2"
echo "Bundler submitter private key: $BUNDLER_TX_SIGNER_KEY"
echo "Subtree updater submitter private key: $SUBTREE_UPDATER_TX_SIGNER_KEY"

CONFIG_PATH_IN_DOCKER=/app/configs/localhost.json

# write bundler's .env file
pushd packages/bundler
cat > .env <<- EOM
REDIS_URL=$BUNDLER_REDIS_URL
REDIS_PASSWORD=$REDIS_PASSWORD

CONFIG_NAME_OR_PATH=$CONFIG_PATH_IN_DOCKER
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

echo "bundler running at PID: $BUNDLER_PID"

# write screener's .env file
pushd packages/deposit-screener
cat > .env <<- EOM
REDIS_URL=$SCREENER_REDIS_URL
REDIS_PASSWORD=$REDIS_PASSWORD

CONFIG_NAME_OR_PATH=$CONFIG_PATH_IN_DOCKER
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

echo "screener running at PID: $SCREENER_PID"

# write subtree updater's .env file
pushd packages/subtree-updater
cat > .env <<- EOM
REDIS_URL=$SUBTREE_UPDATER_REDIS_URL
REDIS_PASSWORD=$REDIS_PASSWORD

CONFIG_NAME_OR_PATH=$CONFIG_PATH_IN_DOCKER
SUBGRAPH_URL=$SUBGRAPH_URL
RPC_URL=$RPC_URL

TX_SIGNER_KEY=$SUBTREE_UPDATER_TX_SIGNER_KEY
EOM
popd

# run subtree updater
docker compose -f ./packages/subtree-updater/docker-compose.yml --env-file packages/subtree-updater/.env up --build  &> "$LOG_DIR/subtree-updater-docker-compose" &
SUBTREE_UPDATER_PID=$!

echo "subtree updater running at PID: $SUBTREE_UPDATER_PID"

SNAP_INDEX_TS="$SCRIPT_DIR/../packages/snap/src/index.ts"
SITE_TEST_PAGE="$SCRIPT_DIR/../packages/site/src/pages/index.tsx"
SITE_CONTRACT_CONFIG_TS="$SCRIPT_DIR/../packages/site/src/config/contracts.ts"

# Set snap handler contract address
sed -i '' -r -e "s/const START_BLOCK = [0-9]*;/const START_BLOCK = ${START_BLOCK};/g" $SNAP_INDEX_TS

# Set site teller address
sed -i '' -r -e "s/export const TELLER_CONTRACT_ADDRESS = \"0x[0-9a-faA-F]+\";/export const TELLER_CONTRACT_ADDRESS = \"$TELLER_CONTRACT_ADDRESS\";/g" $SITE_CONTRACT_CONFIG_TS

# Set test site token address
sed -i '' -r -e "s/const TOKEN_ADDRESS = \"0x[0-9a-faA-F]+\";/const TOKEN_ADDRESS = \"$TOKEN_CONTRACT_ADDR1\";/g" $SITE_TEST_PAGE


wait $SITE_PID
wait $SNAP_PID
wait $BUNDLER_PID
wait $SCREENER_PID
wait $SUBTREE_UPDATER_PID
wait $GRAPH_NODE_PID
wait $HARDHAT_PID
