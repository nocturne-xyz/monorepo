// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "./interfaces/IWallet.sol";
import "./interfaces/ISpend2Verifier.sol";
import "./libs/BatchBinaryMerkle.sol";

import {IBatchMerkle} from "./interfaces/IBatchMerkle.sol";
import {IHasherT3} from "./interfaces/IHasher.sol";
import {IPoseidonT3} from "./interfaces/IPoseidon.sol";
import {PoseidonHasherT3} from "./PoseidonHashers.sol";

contract PoseidonBatchBinaryMerkle is IBatchMerkle {
    using BatchBinaryMerkle for IncrementalTreeData;

    IncrementalTreeData public self;

    constructor(
        uint8 depth,
        uint256 zero,
        IPoseidonT3 _poseidonT3
    ) {
        PoseidonHasherT3 _poseidonHasherT3 = new PoseidonHasherT3(
            address(_poseidonT3)
        );
        self.init(depth, zero, IHasherT3(_poseidonHasherT3));
    }

    function root() external view override returns (uint256) {
        return self.root;
    }

    function commit2FromQueue() external override {
        self.commit2FromQueue();
    }

    function commit8FromQueue() external override {
        self.commit8FromQueue();
    }

    function insertLeafToQueue(uint256 leaf) external override {
        self.insertLeafToQueue(leaf);
    }
}
