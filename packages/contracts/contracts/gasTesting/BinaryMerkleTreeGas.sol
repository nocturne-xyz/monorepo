//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "../libs/BinaryMerkle.sol";
import {IHasherT3} from "../interfaces/IHasher.sol";

contract BinaryMerkleTreeGas {
    using BatchBinaryMerkle for IncrementalTreeData;

    IncrementalTreeData binaryTree;

    uint256 public constant ZERO = 123498798;

    constructor(IHasherT3 _hasherT3) {
        binaryTree.initialize(32, ZERO, _hasherT3);
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
}
