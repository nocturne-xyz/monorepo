cleanup() {
    echo "SIGINT signal caught, cleaning up..."
    docker stop $(docker ps -aq)
    docker rm $(docker ps -aq)
    
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

trap 'cleanup; trap - SIGTERM && kill 0' SIGINT SIGTERM EXIT

pushd packages/e2e-tests
echo "starting hardhat..."
npx hardhat node &> "$LOG_DIR/hardhat" &
HARDHAT_PID=$!
popd

sleep 1

echo "starting graph-node..."
docker-compose -f graph-node/docker/docker-compose.yml up &> "$LOG_DIR/graph-node" &
GRAPH_NODE_PID=$!

sleep 3

echo "running turbo dev script..."
yarn turbo run dev

wait $GRAPH_NODE_PID
wait $HARDHAT_PID
