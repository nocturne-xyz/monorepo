//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

import "../../libs/Types.sol";
import "../../libs/OperationUtils.sol";
import {IHandler} from "../../interfaces/IHandler.sol";
import {BalanceManager} from "../../BalanceManager.sol";

contract TestBalanceManager is IHandler, BalanceManager {
    using OperationLib for Operation;

    function initialize(
        address teller,
        address subtreeUpdateVerifier
    ) external initializer {
        __BalanceManager_init(teller, subtreeUpdateVerifier);
    }

    modifier onlyTeller() {
        require(msg.sender == address(_teller), "Only teller");
        _;
    }

    function addToAssetPrefill(
        EncodedAsset calldata encodedAsset,
        uint256 value
    ) public {
        _addToAssetPrefill(encodedAsset, value);
    }

    // Stub to make testing between Teller<>BalanceManager easier
    function handleDeposit(
        DepositRequest calldata deposit
    ) external override onlyTeller {
        StealthAddress calldata depositAddr = deposit.depositAddr;
        _handleRefundNote(deposit.encodedAsset, depositAddr, deposit.value);
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
        _handleAllRefunds(op);
    }
}
