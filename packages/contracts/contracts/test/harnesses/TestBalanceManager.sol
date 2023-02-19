//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

import "../../libs/Types.sol";
import "../../libs/WalletUtils.sol";
import {BalanceManager} from "../../BalanceManager.sol";

contract TestBalanceManager is BalanceManager {
    using OperationLib for Operation;

    function initialize(
        address vault,
        address joinSplitVerifier,
        address subtreeUpdateVerifier
    ) external initializer {
        __BalanceManager__init(vault, joinSplitVerifier, subtreeUpdateVerifier);
    }

    function makeDeposit(Deposit calldata deposit) public {
        _makeDeposit(deposit);
    }

    function processJoinSplitsReservingFee(Operation calldata op) public {
        _processJoinSplitsReservingFee(op);
    }

    function gatherReservedGasAssetAndPayBundler(
        Operation calldata op,
        OperationResult memory opResult,
        address bundler
    ) public {
        _gatherReservedGasAssetAndPayBundler(op, opResult, bundler);
    }

    function calculateOpGasAssetCost(
        Operation calldata op
    ) public pure returns (uint256) {
        return op.maxGasAssetCost();
    }

    function calculateBundlerGasAssetPayout(
        Operation calldata op,
        OperationResult memory opResult
    ) public pure returns (uint256) {
        return WalletUtils.calculateBundlerGasAssetPayout(op, opResult);
    }

    function handleAllRefunds(Operation calldata op) public {
        _handleAllRefunds(op);
    }
}
