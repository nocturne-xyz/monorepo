#!/bin/sh
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
