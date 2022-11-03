#!/bin/sh
#
# USGGE: ./fixSolidityVerifier.sh [path to solidity verifier]
# Apply various changes the default circom solidity verifier


FILE="$1"
FILENAME="${FILE##*/}"
VERIFIERNAME="${FILENAME%.*}"

echo "Fixing solidity vierfier at $FILE with verifier name $VERIFIERNAME.."

sed -i \
  '/^pragma/s/.*/pragma solidity ^0.8.5;/
  /^pragma/aimport {I'$VERIFIERNAME'} from "./interfaces/I'$VERIFIERNAME'.sol";
  s/contract Verifier/contract '$VERIFIERNAME' is I'$VERIFIERNAME'/
  s/public view returns (bool r)/public override view returns (bool r)/' "$FILE"

