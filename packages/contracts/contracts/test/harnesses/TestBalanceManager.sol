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

    function processJoinSplitsReservingFee(
        Operation calldata op,
        uint256 perJoinSplitVerifyGas
    ) public {
        _processJoinSplitsReservingFee(op, perJoinSplitVerifyGas);
    }

    function gatherReservedGasAssetAndPayBundler(
        Operation calldata op,
        OperationResult memory opResult,
        uint256 perJoinSplitVerifyGas,
        address bundler
    ) public {
        _gatherReservedGasAssetAndPayBundler(
            op,
            opResult,
            perJoinSplitVerifyGas,
            bundler
        );
    }

    function calculateOpGasAssetCost(
        Operation calldata op,
        uint256 perJoinSplitVerifyGas
    ) public pure returns (uint256) {
        return op.maxGasAssetCost(perJoinSplitVerifyGas);
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

    function receivedAssetsLength() public view returns (uint256) {
        return _receivedAssets.length;
    }

    function getReceivedAssetsByIndex(
        uint256 index
    ) public view returns (EncodedAsset memory) {
        return _receivedAssets[index];
    }
}
