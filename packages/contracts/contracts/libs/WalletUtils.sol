// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.17;
import {Groth16} from "../libs/Groth16.sol";
import {Utils} from "../libs/Utils.sol";
import "../libs/types.sol";

// Helpers for Wallet.sol
library WalletUtils {
    using BundleLib for Bundle;

    function computeOperationDigests(
        Operation[] calldata ops
    ) internal pure returns (uint256[] memory) {
        uint256 numOps = ops.length;
        uint256[] memory opDigests = new uint256[](numOps);
        for (uint256 i = 0; i < numOps; i++) {
            opDigests[i] = computeOperationDigest(ops[i]);
        }

        return opDigests;
    }

    function extractJoinSplitProofsAndPis(
        Operation[] calldata ops,
        uint256[] memory digests
    )
        internal
        pure
        returns (Groth16.Proof[] memory proofs, uint256[][] memory allPis)
    {
        uint256 numOps = ops.length;

        // compute number of joinsplits in the bundle
        uint256 numJoinSplits = 0;
        for (uint256 i = 0; i < numOps; i++) {
            numJoinSplits += ops[i].joinSplitTxs.length;
        }

        proofs = new Groth16.Proof[](numJoinSplits);
        allPis = new uint256[][](numJoinSplits);

        // current index into proofs and pis
        uint256 index = 0;

        // Batch verify all the joinsplit proofs
        for (uint256 i = 0; i < numOps; i++) {
            Operation memory op = ops[i];
            for (uint256 j = 0; j < numJoinSplits; j++) {
                proofs[index] = Utils.proof8ToStruct(op.joinSplitTxs[j].proof);
                allPis[index] = new uint256[](9);
                allPis[index][0] = op.joinSplitTxs[j].newNoteACommitment;
                allPis[index][1] = op.joinSplitTxs[j].newNoteBCommitment;
                allPis[index][2] = op.joinSplitTxs[j].commitmentTreeRoot;
                allPis[index][3] = op.joinSplitTxs[j].publicSpend;
                allPis[index][4] = op.joinSplitTxs[j].nullifierA;
                allPis[index][5] = op.joinSplitTxs[j].nullifierB;
                allPis[index][6] = digests[i];
                allPis[index][7] = op.joinSplitTxs[j].encodedAssetAddr;
                allPis[index][8] = op.joinSplitTxs[j].encodedAssetId;
                index++;
            }
        }

        return (proofs, allPis);
    }

    // TODO: do we need a domain in the payload?
    // TODO: turn encodedFunctions and contractAddresses into their own arrays, so we don't have to call abi.encodePacked for each one
    // Careful about declaring local variables in this function. Stack depth is around the limit.
    function computeOperationDigest(
        Operation calldata op
    ) internal pure returns (uint256) {
        bytes memory actionPayload;

        Action memory action;
        uint256 numActions = op.actions.length;
        for (uint256 i = 0; i < numActions; i++) {
            action = op.actions[i];
            actionPayload = abi.encodePacked(
                actionPayload,
                action.contractAddress,
                keccak256(action.encodedFunction)
            );
        }

        bytes memory joinSplitTxsPayload;
        uint256 numJoinSplits = op.joinSplitTxs.length;
        for (uint256 i = 0; i < numJoinSplits; i++) {
            joinSplitTxsPayload = abi.encodePacked(
                joinSplitTxsPayload,
                keccak256(
                    abi.encodePacked(
                        op.joinSplitTxs[i].commitmentTreeRoot,
                        op.joinSplitTxs[i].nullifierA,
                        op.joinSplitTxs[i].nullifierB,
                        op.joinSplitTxs[i].newNoteACommitment,
                        op.joinSplitTxs[i].newNoteBCommitment,
                        op.joinSplitTxs[i].publicSpend,
                        op.joinSplitTxs[i].encodedAssetAddr,
                        op.joinSplitTxs[i].encodedAssetId
                    )
                )
            );
        }

        bytes memory refundAssetsPayload;
        for (uint256 i = 0; i < op.encodedRefundAssets.length; i++) {
            refundAssetsPayload = abi.encodePacked(
                refundAssetsPayload,
                op.encodedRefundAssets[i].encodedAssetAddr,
                op.encodedRefundAssets[i].encodedAssetId
            );
        }

        bytes memory refundAddrPayload = abi.encodePacked(
            op.refundAddr.h1X,
            op.refundAddr.h1Y,
            op.refundAddr.h2X,
            op.refundAddr.h2Y
        );

        bytes memory payload = abi.encodePacked(
            actionPayload,
            joinSplitTxsPayload,
            refundAssetsPayload,
            refundAddrPayload,
            op.executionGasLimit,
            op.gasPrice,
            op.maxNumRefunds
        );

        return uint256(keccak256(payload)) % Utils.SNARK_SCALAR_FIELD;
    }

    // From https://ethereum.stackexchange.com/questions/83528
    function _getRevertMsg(
        bytes memory reason
    ) internal pure returns (string memory) {
        // If the _res length is less than 68, then the transaction failed silently (without a revert message)
        if (reason.length < 68) {
            return "Transaction reverted silently";
        }

        assembly {
            // Slice the sighash.
            reason := add(reason, 0x04)
        }
        return abi.decode(reason, (string)); // All that remains is the revert string
    }

    function _failOperationWithReason(
        string memory reason
    ) internal pure returns (OperationResult memory result) {
        return
            OperationResult({
                opProcessed: false,
                failureReason: reason,
                callSuccesses: new bool[](0),
                callResults: new bytes[](0),
                executionGasUsed: 0,
                verificationGasUsed: 0,
                refundGasUsed: 0
            });
    }

    // TODO: properly process this failure case
    function _unsuccessfulOperation(
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
                executionGasUsed: 0,
                verificationGasUsed: 0,
                refundGasUsed: 0
            });
    }

    function verificationGasForOp(
        Bundle calldata bundle,
        uint256 opIndex,
        uint256 batchVerificationGas
    ) internal pure returns (uint256) {
        return
            (batchVerificationGas / bundle.totalNumJoinSplits()) *
            bundle.operations[opIndex].joinSplitTxs.length;
    }
}
