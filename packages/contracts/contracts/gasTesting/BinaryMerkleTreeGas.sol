//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../BatchBinaryMerkleTree.sol";

contract BinaryMerkleTreeGas {
    using BatchBinaryMerkleTree for IncrementalTreeData;

    IncrementalTreeData binaryTree;

    uint256 public constant ZERO = 123498798;

    constructor() {
        binaryTree.init(32, ZERO);
    }

    function insertLeaf(uint256 leaf) public {
        binaryTree.insert(leaf);
    }

    function insert2Leaves(uint256[2] calldata leaves) public {
        binaryTree.insert2(leaves);
    }

    function insert8Leaves(uint256[8] calldata leaves) public {
        binaryTree.insert8(leaves);
    }

    function insert16Leaves(uint256[16] calldata leaves) public {
        binaryTree.insert16(leaves);
    }

    function insertLeafToQueue(uint256 leaf) public {
        binaryTree.insertLeafToQueue(leaf);
    }

    function insertLeavesToQueue(uint256[] memory leaves) public {
        binaryTree.insertLeavesToQueue(leaves);
    }

    function commit8FromQueue() public {
        binaryTree.commit8FromQueue();
    }

    function commit16FromQueue() public {
        binaryTree.commit16FromQueue();
    }
}
