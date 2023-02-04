E2E_DIR="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )" 
CONTRACTS_DIR="$E2E_DIR/../contracts/contracts"

rsync -av --exclude="test/**.sol" "$CONTRACTS_DIR" "$E2E_DIR"
rsync -av "$CONTRACTS_DIR/test/utils/Pairing.sol" "$E2E_DIR/contracts/test/utils"
rsync -av "$CONTRACTS_DIR/test/utils/TestSubtreeUpdateVerifier.sol" "$E2E_DIR/contracts/test/utils"