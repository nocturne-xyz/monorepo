SCRIPT_DIR="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )" 
CONTRACTS_DIR="$SCRIPT_DIR/../../contracts"
cd "$CONTRACTS_DIR"

cd "$CONTRACTS_DIR"
yarn verify:hardhat $1 $2 $3 $4 $5 $6 $7 $8 $9

cd "$SCRIPT_DIR"
