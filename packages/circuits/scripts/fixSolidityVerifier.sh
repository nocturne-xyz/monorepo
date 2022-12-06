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

# fix pragma, import interface and declare contract to implement it
$CMD -i \
  '/^pragma/s/.*/pragma solidity ^0.8.5;/
  /^pragma/aimport {I'$VERIFIERNAME'} from "./interfaces/I'$VERIFIERNAME'.sol";
  s/contract Verifier/contract '$VERIFIERNAME' is I'$VERIFIERNAME'/' "$FILE"

# import Pairing
$CMD -ni \
  '1,/^import/p
  /^import/aimport {Pairing} from "./libs/Pairing.sol";
  /contract/,$p' "$FILE"

# import BatchVerifier
$CMD -i '/^import {Pairing}/aimport {BatchVerifier} from "./libs/BatchVerifier.sol";' "$FILE"

# import IVerifier 
$CMD -i '/^import {BatchVerifier}/aimport {IVerifier} from "./interfaces/IVerifier.sol";' "$FILE"

# delete local defn of VerifyingKey and Proof
$CMD -i '/struct VerifyingKey/,+11d' "$FILE"

# replace all mentions of Proof with `IVerifier.Proof`
$CMD -i 's/\(\s*\)Proof/\1IVerifier.Proof/g' "$FILE"

# replace all mentions of VerifyingKey with `IVerifier.VerifyingKey`
$CMD -i 's/\(\s*\)VerifyingKey/\1IVerifier.VerifyingKey/g' "$FILE"

# replace all mentions of alfa1 with `alpha1`
$CMD -i 's/alfa1/alpha1/g' "$FILE"

# delete the old `verifyProof` method and closing brace
head -n -22 "$FILE" > "$FILE.tmp" && mv "$FILE.tmp" "$FILE" 

# then insert the public methods code and closing brace afterwards
echo "
    /// @return r  bool true if proof is valid
    function verifyProof(
        IVerifier.Proof memory proof,
        uint256[] memory pis
    ) public view override returns (bool r) {
        if (verify(pis, proof) == 0) {
            return true;
        } else {
            return false;
        }
    }

    /// @return r bool true if proofs are valid
    function batchVerifyProofs(
        IVerifier.Proof[] memory proofs,
        uint256[] memory pisFlat
    ) public view override returns (bool) {
        return
            BatchVerifier.batchVerifyProofs(
                verifyingKey(),
                proofs,
                pisFlat
            );
    }
}
" >> "$FILE"
