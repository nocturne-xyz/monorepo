//SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.17;

import "../../libs/Types.sol";
import "../../libs/OperationUtils.sol";
import {ITeller} from "../../interfaces/ITeller.sol";
import {IHandler} from "../../interfaces/IHandler.sol";
import {BalanceManager} from "../../BalanceManager.sol";
import {AssetUtils} from "../../libs/AssetUtils.sol";

contract TestBalanceManager is IHandler, BalanceManager {
    using OperationLib for Operation;

    function initialize(
        address subtreeUpdateVerifier,
        address priceOracle,
        address leftoverTokensHolder
    ) external initializer {
        __BalanceManager_init(
            subtreeUpdateVerifier,
            priceOracle,
            leftoverTokensHolder
        );
    }

    modifier onlyTeller() {
        require(msg.sender == address(_teller), "Only teller");
        _;
    }

    // Stub to make testing between Teller<>BalanceManager easier
    function handleDeposit(
        Deposit calldata deposit
    ) external override onlyTeller returns (uint128 merkleIndex) {
        return
            _handleRefundNote(
                deposit.encodedAsset,
                deposit.depositAddr,
                deposit.value
            );
    }

    function handleOperation(
        Operation calldata, // op
        uint256, // perJoinSplitVerifyGas
        address // bundler
    ) external pure override returns (OperationResult memory) {
        revert("Should not call this on TestBalanceManager");
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

    function calculateOpMaxGasAssetCost(
        Operation calldata op,
        uint256 perJoinSplitVerifyGas
    ) public pure returns (uint256) {
        return op.maxGasAssetCost(perJoinSplitVerifyGas);
    }

    function calculateBundlerGasAssetPayout(
        Operation calldata op,
        OperationResult memory opResult
    ) public pure returns (uint256) {
        return OperationUtils.calculateBundlerGasAssetPayout(op, opResult);
    }

    function handleAllRefunds(Operation calldata op) public {
        // Get outstanding amounts for each asset (normally handled in Handler)
        uint256[] memory outstandingAmounts = new uint256[](
            op.trackedAssets.length
        );
        for (uint256 i = 0; i < op.trackedAssets.length; i++) {
            outstandingAmounts[i] = AssetUtils.balanceOfAsset(
                op.trackedAssets[i].encodedAsset
            );
        }

        _handleAllRefunds(op, outstandingAmounts);
    }
}
