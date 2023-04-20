// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

import {TestBalanceManager} from "../../harnesses/TestBalanceManager.sol";
import "../../../libs/Types.sol";

contract TestBalanceManagerHandler {
    // ______PUBLIC______
    TestBalanceManager public testBalanceManager;
    bytes32 public lastCall;

    // ______INTERNAL______
    mapping(bytes32 => uint256) internal _calls;

    constructor(TestBalanceManager _testBalanceManager) {
        testBalanceManager = _testBalanceManager;
    }

    modifier trackCall(bytes32 key) {
        lastCall = key;
        _calls[key]++;
        _;
    }

    function addToAssetPrefill(
        EncodedAsset calldata encodedAsset,
        uint256 value
    ) public trackCall("addToAssetPrefill") {
        testBalanceManager.addToAssetPrefill(encodedAsset, value);
    }

    function handleDeposit(
        DepositRequest calldata deposit
    ) public trackCall("handleDeposit") {
        testBalanceManager.handleDeposit(deposit);
    }

    function processJoinSplitsReservingFee(
        Operation calldata op,
        uint256 perJoinSplitVerifyGas
    ) public trackCall("processJoinSplitsReservingFee") {
        testBalanceManager.processJoinSplitsReservingFee(
            op,
            perJoinSplitVerifyGas
        );
    }

    function gatherReservedGasAndPayBundler(
        Operation calldata op,
        OperationResult memory opResult,
        uint256 perJoinSplitVerifyGas,
        address bundler
    ) public trackCall("gatherReservedGasAndPayBundler") {
        testBalanceManager.gatherReservedGasAssetAndPayBundler(
            op,
            opResult,
            perJoinSplitVerifyGas,
            bundler
        );
    }

    function handleAllRefunds(
        Operation calldata op
    ) public trackCall("handleAllRefunds") {
        testBalanceManager.handleAllRefunds(op);
    }
}
