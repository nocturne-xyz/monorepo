//SPDX-License-Identifier: Unlicense
pragma solidity 0.7.6;

import "../libs/BatchBinaryMerkle.sol";

contract BinaryMerkleTreeGas {
    using BatchBinaryMerkle for IncrementalTreeData;

    IncrementalTreeData binaryTree;

    uint256 public constant ZERO = 123498798;

    constructor(address _hasherT3) {
        binaryTree.init(32, ZERO, _hasherT3);
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
