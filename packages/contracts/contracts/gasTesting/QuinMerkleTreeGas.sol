//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./BatchQuinMerkleTree.sol";

contract QuinMerkleTreeGas {
    using BatchQuinMerkleTree for IncrementalTreeData;

    IncrementalTreeData quinTree;

    uint256 public constant ZERO = 123498798;

    constructor() {
        quinTree.init(14, ZERO);
    }

    function insertLeaf(uint256 leaf) public {
        quinTree.insert(leaf);
    }

    function insertBatch5(uint256[5] calldata leaves) public {
        quinTree.insertBatch5(leaves);
    }
}
