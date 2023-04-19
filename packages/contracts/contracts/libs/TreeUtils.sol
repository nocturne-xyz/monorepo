// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.17;
import {IWallet} from "../interfaces/IWallet.sol";
import "./Types.sol";

// helpers for converting to/from field elems, uint256s, and/or bytes, and hashing them
library TreeUtils {
    uint256 public constant DEPTH = 32;
    uint256 public constant BATCH_SIZE = 16;
    uint256 public constant LOG2_BATCH_SIZE = 4;
    uint256 public constant BATCH_SUBTREE_DEPTH = 4;
    uint256 public constant EMPTY_TREE_ROOT =
        21443572485391568159800782191812935835534334817699172242223315142338162256601;

    // packs a field element for the `encodedPathAndHash` input to the subtree update verifier
    // `subtreeIdx` is the index of the subtree's leftmost element in the tree
    // `accumulatorHashHi` is the top 3 bits of `accumulatorHash` gotten from `uint256ToFieldElemLimbs`
    function encodePathAndHash(
        uint128 subtreeIdx,
        uint256 accumulatorHashHi
    ) internal pure returns (uint256) {
        require(
            subtreeIdx % BATCH_SIZE == 0,
            "subtreeIdx not multiple of BATCH_SIZE"
        );
        uint256 encodedPathAndHash = uint256(subtreeIdx) >> BATCH_SUBTREE_DEPTH;
        encodedPathAndHash |=
            accumulatorHashHi <<
            (DEPTH - BATCH_SUBTREE_DEPTH);

        return encodedPathAndHash;
    }

    // hash array of field elements / uint256s as big-endian bytes with sha256
    function sha256FieldElems(
        uint256[] memory elems
    ) internal pure returns (bytes32) {
        return sha256(abi.encodePacked(elems));
    }

    function sha256Note(
        EncodedNote memory note
    ) internal pure returns (uint256) {
        uint256[] memory elems = new uint256[](6);
        elems[0] = note.ownerH1;
        elems[1] = note.ownerH2;
        elems[2] = note.nonce;
        elems[3] = note.encodedAssetAddr;
        elems[4] = note.encodedAssetId;
        elems[5] = note.value;
        return uint256(sha256FieldElems(elems));
    }

    // return uint256 as two limbs - one uint256 containing the 3 hi bits, the
    // other containing the lower 253 bits
    function uint256ToFieldElemLimbs(
        uint256 n
    ) internal pure returns (uint256, uint256) {
        return _splitUint256ToLimbs(n, 253);
    }

    // split a uint256 into 2 limbs, one containing the high (256 - lowerBits)
    // bits, the other containing the lower `lowerBits` bits
    function _splitUint256ToLimbs(
        uint256 n,
        uint256 lowerBits
    ) internal pure returns (uint256, uint256) {
        uint256 hi = n >> lowerBits;
        uint256 lo = n & ((1 << lowerBits) - 1);
        return (hi, lo);
    }
}
