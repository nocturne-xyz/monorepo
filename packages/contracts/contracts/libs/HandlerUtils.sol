// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.17;
import {Groth16} from "../libs/Groth16.sol";
import {Utils} from "../libs/Utils.sol";
import "../libs/types.sol";

library HandlerUtils {
    // TODO: properly process this failure case
    function unsuccessfulOperation(
        Operation calldata op,
        bytes memory result
    ) internal pure returns (OperationResult memory) {
        bool[] memory callSuccesses = new bool[](1);
        callSuccesses[0] = false;
        bytes[] memory callResults = new bytes[](1);
        callResults[0] = result;
        return
            OperationResult({
                opProcessed: true,
                failureReason: "",
                callSuccesses: callSuccesses,
                callResults: callResults,
                executionGas: 0,
                verificationGas: 0,
                numRefunds: op.joinSplitTxs.length +
                    op.encodedRefundAssets.length
            });
    }

    function calculateBundlerGasAssetPayout(
        Operation calldata op,
        OperationResult memory opResult
    ) internal pure returns (uint256) {
        uint256 handleRefundGas = _handleRefundGas(opResult.numRefunds);

        return
            op.gasPrice *
            (opResult.executionGas +
                opResult.verificationGas +
                handleRefundGas);
    }

    function _handleRefundGas(
        uint256 numRefunds
    ) internal pure returns (uint256) {
        return numRefunds * GAS_PER_REFUND_HANDLE;
    }

    function _treeRefundGas(
        uint256 numRefunds
    ) internal pure returns (uint256) {
        return numRefunds * GAS_PER_REFUND_TREE;
    }
}
