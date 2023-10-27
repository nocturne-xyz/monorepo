#! /usr/bin/env bash

cleanup() {
    echo "SIGINT signal caught, cleaning up..."
    docker stop $(docker ps -aq)
    docker rm $(docker ps -aq)

    if  [-n $SNAP_PID ]; then
        echo "Killing snap process $SNAP_PID"
        kill $SNAP_PID
    fi

    pid=$(lsof -t -i:8545)
    if [ -n "$pid" ]; then
        echo "Lurking zombie process on 8545, killing process"
        kill $pid
        echo "Killed process $pid ✅. Headshot! 🧟‍♂️"
    fi

    echo "——————————————————————————————"
    echo "Done 🧹🧹🧹"
    exit
}


SCRIPT_DIR="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
ROOT_DIR="$SCRIPT_DIR/../"
LOG_DIR="$ROOT_DIR/logs"
rm -rf "$LOG_DIR/**"
mkdir -p "$LOG_DIR"

trap 'cleanup; trap - SIGTERM && kill 0' SIGINT SIGTERM EXIT

echo 'Initializing submodules if necessary'
git submodule update --init

pushd packages/e2e-tests
echo "starting hardhat..."
npx hardhat node &> "$LOG_DIR/hardhat" &
HARDHAT_PID=$!
popd


echo 'starting bundler redis'
docker run -d --name bundler-redis -p 6379:6379 --rm redis redis-server --port 6379 --loglevel warning

echo 'starting screener redis'
docker run -d --name deposit-screener-redis -p 6380:6380 --rm redis redis-server --port 6380 --loglevel warning

echo 'starting insertion log redis'
docker run -d --name insertion-log-redis -p 6381:6381 --rm redis redis-server --port 6381 --loglevel warning


sleep 1


echo "starting graph-node..."
docker-compose -f graph-node/docker/docker-compose.yml up &> "$LOG_DIR/graph-node" &
GRAPH_NODE_PID=$!

sleep 5

echo "running yarn build"
yarn build

echo "starting snap"
pushd "$ROOT_DIR/snap"
yarn dev &
SNAP_PID=$!
popd

echo "running turbo dev script..."
yarn turbo run dev

wait $SNAP_PID
wait $GRAPH_NODE_PID
wait $HARDHAT_PID

