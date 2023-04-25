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

struct EncodedAssetPublicSpend {
    EncodedAsset encodedAsset;
    uint256 publicSpend;
}

uint256 constant PER_JOINSPLIT_VERIFY_GAS = 220_000; // TODO: make this more random

library BalanceManagerOpUtils {
    uint256 constant MAX_NUM_ASSETS = 100;

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

    function extractAssetsAndTotalPublicSpend(
        JoinSplit[] memory joinSplits
    ) public pure returns (EncodedAssetPublicSpend[] memory) {
        EncodedAssetPublicSpend[MAX_NUM_ASSETS] memory assetPublicSpend;
        uint256 numAssets = 0;
        for (uint i = 0; i < joinSplits.length; i++) {
            EncodedAsset memory encodedAsset = joinSplits[i].encodedAsset;
            uint256 publicSpend = joinSplits[i].publicSpend;
            uint256 j = 0;
            for (; j < numAssets; j++) {
                if (
                    assetPublicSpend[j].encodedAsset.encodedAssetAddr ==
                    encodedAsset.encodedAssetAddr &&
                    assetPublicSpend[j].encodedAsset.encodedAssetId ==
                    encodedAsset.encodedAssetId
                ) {
                    assetPublicSpend[j].publicSpend += publicSpend;
                    break;
                }
            }
            if (j == numAssets) {
                assetPublicSpend[j].encodedAsset = encodedAsset;
                assetPublicSpend[j].publicSpend = publicSpend;
                numAssets++;
            }
        }
        EncodedAssetPublicSpend[]
            memory uniqueAssets = new EncodedAssetPublicSpend[](numAssets);
        for (uint k = 0; k < numAssets; k++) {
            uniqueAssets[k] = assetPublicSpend[k];
        }
        return uniqueAssets;
    }
}
