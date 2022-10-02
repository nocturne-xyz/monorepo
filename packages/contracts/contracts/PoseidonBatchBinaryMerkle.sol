// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/IWallet.sol";
import "./interfaces/IVerifier.sol";
import "./libs/BatchBinaryMerkle.sol";

import {IBatchMerkle} from "./interfaces/IBatchMerkle.sol";
import {IPoseidonT3} from "./interfaces/IPoseidon.sol";

contract PoseidonBatchBinaryMerkle is IBatchMerkle {
    using BatchBinaryMerkle for IncrementalTreeData;

    IncrementalTreeData public self;

    constructor(
        uint8 depth,
        uint256 zero,
        IPoseidonT3 _poseidonT3
    ) {
        self.init(depth, zero, address(_poseidonT3));
    }

    function root() external view override returns (uint256) {
        return self.root;
    }

    function commit8FromQueue() external override {
        self.commit8FromQueue();
    }

    function insertLeafToQueue(uint256 leaf) external override {
        self.insertLeafToQueue(leaf);
    }
}
