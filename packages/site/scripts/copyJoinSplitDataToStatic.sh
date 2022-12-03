SCRIPT_DIR=$(dirname "$0")
ROOT_DIR="$SCRIPT_DIR/../../.."
CIRCUIT_ARTIFACTS_DIR="$ROOT_DIR/circuit-artifacts"

echo "Copying joinsplit data from circuit-artifacts to site/static..."
cp "$CIRCUIT_ARTIFACTS_DIR/joinsplit/joinsplit_js/joinsplit.wasm" "$SCRIPT_DIR/../static/joinsplit.wasm"
cp "$CIRCUIT_ARTIFACTS_DIR/joinsplit/joinsplit_cpp/joinsplit.zkey" "$SCRIPT_DIR/../static/joinsplit.zkey"