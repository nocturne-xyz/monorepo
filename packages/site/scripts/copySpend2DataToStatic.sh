SCRIPT_DIR=$(dirname "$0")
ROOT_DIR="$SCRIPT_DIR/../../.."
CIRCUIT_ARTIFACTS_DIR="$ROOT_DIR/circuit-artifacts"

echo "Copying spend2 data from circuit-artifacts to site/static..."
cp "$CIRCUIT_ARTIFACTS_DIR/spend2/spend2_js/spend2.wasm" "$SCRIPT_DIR/../static/spend2.wasm"
cp "$CIRCUIT_ARTIFACTS_DIR/spend2/spend2_cpp/spend2.zkey" "$SCRIPT_DIR/../static/spend2.zkey"