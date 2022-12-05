#!/bin/bash
#
# USGGE: ./fixSolidityVerifier.sh [path to solidity verifier]
# Apply various changes the default circom solidity verifier


FILE="$1"
FILENAME="${FILE##*/}"
VERIFIERNAME="${FILENAME%.*}"

CMD="sed"

if [[ $OSTYPE == 'darwin'* ]]; then
  echo "macOS detected... using gsed instead"
  CMD="gsed"
fi


echo "Post processing solidity vierfier at $FILE with verifier name $VERIFIERNAME.."

$CMD -i \
  '/^pragma/s/.*/pragma solidity ^0.8.5;/
  /^pragma/aimport {I'$VERIFIERNAME'} from "./interfaces/I'$VERIFIERNAME'.sol";
  s/contract Verifier/contract '$VERIFIERNAME' is I'$VERIFIERNAME'/
  s/public view returns (bool r)/public override view returns (bool r)/' "$FILE"

$CMD -ni \
  '1,/^import/p
  /^import/aimport {Pairing} from "./libs/Pairing.sol";
  /contract/,$p' "$FILE"

$CMD -ni \
  '2,/^import/p
  /^import/aimport {BatchVerifier} from "./libs/BatchVerifier.sol";
  /contract/,$p' "$FILE"

# delete the closing brace

head -n -1 "$FILE" > "$FILE.tmp" && mv "$FILE.tmp" "$FILE" && rm "$FILE.tmp"

# then insert the method code and reinsert closing brace afterwards

echo "
    /// @return r bool true if proofs are valid
    function batchVerifyProofs(
        uint256[] memory proofsFlat,
        uint256[] memory pisFlat,
        uint256 numProofs
    ) public view override returns (bool) {
        VerifyingKey memory vk = verifyingKey();
        uint256[14] memory vkFlat = BatchVerifier.flattenVK(
            vk.alfa1,
            vk.beta2,
            vk.gamma2,
            vk.delta2
        );

        return BatchVerifier.batchVerifyProofs(vkFlat, vk.IC, proofsFlat, pisFlat, numProofs);
    }
}
" >> "$FILE"
