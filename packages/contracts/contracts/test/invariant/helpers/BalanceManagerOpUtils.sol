// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "../../../libs/Types.sol";

struct OperationWithoutStructArrays {
    StealthAddress refundAddr;
    EncodedAsset encodedGasAsset;
    uint256 executionGasLimit;
    uint256 maxNumRefunds;
    uint256 gasPrice;
    uint256 chainId;
    uint256 deadline;
    bool atomicActions;
}

struct OperationStructArrays {
    JoinSplit[] joinSplits;
    EncodedAsset[] encodedRefundAssets;
    Action[] actions;
}

library BalanceManagerOpUtils {
    function joinOperation(
        OperationWithoutStructArrays memory op,
        OperationStructArrays memory opStructArrays
    ) internal pure returns (Operation memory _op) {
        _op.joinSplits = opStructArrays.joinSplits;
        _op.refundAddr = op.refundAddr;
        _op.encodedRefundAssets = opStructArrays.encodedRefundAssets;
        _op.actions = opStructArrays.actions;
        _op.encodedGasAsset = op.encodedGasAsset;
        _op.executionGasLimit = op.executionGasLimit;
        _op.maxNumRefunds = op.maxNumRefunds;
        _op.gasPrice = op.gasPrice;
        _op.chainId = op.chainId;
        _op.deadline = op.deadline;
        _op.atomicActions = op.atomicActions;
    }
}
