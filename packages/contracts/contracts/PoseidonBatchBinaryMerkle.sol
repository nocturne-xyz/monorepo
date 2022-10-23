// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "./interfaces/IWallet.sol";
import "./interfaces/ISpend2Verifier.sol";
import {IncrementalTreeData, BatchBinaryMerkle} from "./libs/BinaryMerkle.sol";
import {QueueLib} from "./libs/Queue.sol";

import {IBatchMerkle} from "./interfaces/IBatchMerkle.sol";
import {IHasherT3} from "./interfaces/IHasher.sol";
import {IPoseidonT3} from "./interfaces/IPoseidon.sol";
import {PoseidonHasherT3} from "./PoseidonHashers.sol";

contract PoseidonBatchBinaryMerkle is IBatchMerkle {
    using BatchBinaryMerkle for IncrementalTreeData;
    using QueueLib for QueueLib.Queue;

    QueueLib.Queue public queue;
    IncrementalTreeData public tree;

    constructor(
        uint8 depth,
        uint256 zero,
        IPoseidonT3 _poseidonT3
    ) {
        PoseidonHasherT3 _poseidonHasherT3 = new PoseidonHasherT3(
            address(_poseidonT3)
        );
        queue.initialize();
        tree.initialize(depth, zero, IHasherT3(_poseidonHasherT3));
    }

    function root() external view override returns (uint256) {
        return tree.root;
    }

    function tentativeCount() external view override returns (uint256) {
        return tree.numberOfLeaves + queue.length();
    }

    function commit2FromQueue() external override {
        uint256[2] memory leaves = queue.dequeue2();
        tree.insert2(leaves);
    }

    function commit8FromQueue() external override {
        uint256[8] memory leaves = queue.dequeue8();
        tree.insert8(leaves);
    }

    function insertLeafToQueue(uint256 leaf) external override {
        queue.enqueue(leaf);
    }

    function insertLeavesToQueue(uint256[] memory leaves) external override {
        queue.enqueue(leaves);
    }
}
