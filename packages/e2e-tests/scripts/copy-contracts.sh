SCRIPT_DIR=$(dirname "$0")
ROOT_DIR="$SCRIPT_DIR/../../.."
CONTRACTS_DIR="$ROOT_DIR/packages/contracts"

echo "Copying contracts from packages/contracts packages/e2e-tests..."
cp -r "$CONTRACTS_DIR/contracts" "$SCRIPT_DIR/../contracts"

CONTRACTS_TEST_DIR="$SCRIPT_DIR/../contracts/test"
cd "$CONTRACTS_TEST_DIR"

echo "Removing test files that depend on forge-std..."
find "$CONTRACTS_TEST_DIR" -maxdepth 0 ! -name "$CONTRACTS_TEST_DIR/utils/TestSubtreeUpdateVerifier.sol" ! -name "$CONTRACTS_TEST_DIR/utils/Pairing.sol" -prune -exec rm -r {} \;