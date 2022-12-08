// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.5;
import {IWallet} from "../interfaces/IWallet.sol";

// helpers for converting to/from field elems, uint256s, and/or bytes, and hashing them
library TreeUtils {
    uint256 public constant DEPTH = 32;
    uint256 public constant BATCH_SIZE = 16;
    uint256 public constant BATCH_SUBTREE_DEPTH = 4;
    uint256 public constant EMPTY_TREE_ROOT =
        21443572485391568159800782191812935835534334817699172242223315142338162256601;

    // packs a field element for the `encodedPathAndHash` input to the subtree update verifier
    // `subtreeIdx` is the index of the subtree's leftmost element in the tree
    // `accumulatorHashHi` is the top 3 bits of `accumulatorHash` gotten from `uint256ToFieldElemLimbs`
    function encodePathAndHash(
        uint128 _subtreeIdx,
        uint256 _accumulatorHashHi
    ) internal pure returns (uint256) {
        require(
            _subtreeIdx % BATCH_SIZE == 0,
            "subtreeIdx not multiple of BATCH_SIZE"
        );
        uint256 _encodedPathAndHash = uint256(_subtreeIdx) >>
            BATCH_SUBTREE_DEPTH;
        _encodedPathAndHash |=
            _accumulatorHashHi <<
            (DEPTH - BATCH_SUBTREE_DEPTH);

        return _encodedPathAndHash;
    }
}
