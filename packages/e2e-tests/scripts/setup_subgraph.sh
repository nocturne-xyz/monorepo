SCRIPT_DIR="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )" 

cd "$SCRIPT_DIR/../../../subgraph/"
yarn install
yarn build