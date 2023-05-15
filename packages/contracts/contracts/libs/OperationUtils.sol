// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.17;
import {Groth16} from "../libs/Groth16.sol";
import {Utils} from "../libs/Utils.sol";
import "../libs/Types.sol";

// Helpers for extracting data / formatting operations
library OperationUtils {
    function extractJoinSplitProofsAndPis(
        Operation[] calldata ops,
        uint256[] memory digests
    )
        internal
        pure
        returns (uint256[8][] memory proofs, uint256[][] memory allPis)
    {
        uint256 numOps = ops.length;

        // compute number of joinsplits in the bundle
        uint256 numJoinSplits = 0;
        for (uint256 i = 0; i < numOps; i++) {
            numJoinSplits += ops[i].joinSplits.length;
        }

        proofs = new uint256[8][](numJoinSplits);
        allPis = new uint256[][](numJoinSplits);

        // current index into proofs and pis
        uint256 index = 0;

        // Batch verify all the joinsplit proofs
        for (uint256 i = 0; i < numOps; i++) {
            Operation memory op = ops[i];
            uint256 numJoinSplitsForOp = op.joinSplits.length;
            for (uint256 j = 0; j < numJoinSplitsForOp; j++) {
                proofs[index] = op.joinSplits[j].proof;
                allPis[index] = new uint256[](11);
                allPis[index][0] = op.joinSplits[j].newNoteACommitment;
                allPis[index][1] = op.joinSplits[j].newNoteBCommitment;
                allPis[index][2] = op.joinSplits[j].commitmentTreeRoot;
                allPis[index][3] = op.joinSplits[j].publicSpend;
                allPis[index][4] = op.joinSplits[j].nullifierA;
                allPis[index][5] = op.joinSplits[j].nullifierB;
                allPis[index][6] = op.joinSplits[j].encSenderCanonAddrC1X;
                allPis[index][7] = op.joinSplits[j].encSenderCanonAddrC2X;
                allPis[index][8] = digests[i];
                allPis[index][9] = op
                    .joinSplits[j]
                    .encodedAsset
                    .encodedAssetAddr;
                allPis[index][10] = op
                    .joinSplits[j]
                    .encodedAsset
                    .encodedAssetId;
                index++;
            }
        }

        return (proofs, allPis);
    }

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

    // Careful about declaring local variables in this function. Stack depth is around the limit.
    function computeOperationDigest(
        Operation calldata op
    ) internal pure returns (uint256) {
        // Split payload packing due to stack size limit
        bytes memory payload = abi.encodePacked(
            _createJoinSplitsPayload(op.joinSplits),
            abi.encodePacked(
                op.refundAddr.h1X,
                op.refundAddr.h1Y,
                op.refundAddr.h2X,
                op.refundAddr.h2Y
            ),
            _createRefundAssetsPayload(op.encodedRefundAssets),
            _createActionsPayload(op.actions),
            abi.encodePacked(
                op.encodedGasAsset.encodedAssetAddr,
                op.encodedGasAsset.encodedAssetId
            )
        );
        payload = abi.encodePacked(
            payload,
            op.executionGasLimit,
            op.maxNumRefunds,
            op.gasPrice,
            op.chainId,
            op.deadline,
            op.atomicActions
        );

        return uint256(keccak256(payload)) % Utils.SNARK_SCALAR_FIELD;
    }

    function calculateBundlerGasAssetPayout(
        Operation calldata op,
        OperationResult memory opResult
    ) internal pure returns (uint256) {
        uint256 handleJoinSplitGas = op.joinSplits.length *
            GAS_PER_JOINSPLIT_HANDLE;
        uint256 handleRefundGas = opResult.numRefunds * GAS_PER_REFUND_HANDLE;

        return
            op.gasPrice *
            (opResult.verificationGas +
                handleJoinSplitGas +
                opResult.executionGas +
                handleRefundGas);
    }

    // From https://ethereum.stackexchange.com/questions/83528
    // returns empty string if no revert message
    function getRevertMsg(
        bytes memory reason
    ) internal pure returns (string memory) {
        // If the _res length is less than 68, then the transaction failed silently (without a revert message)
        if (reason.length < 68) {
            return "";
        }

        assembly {
            // Slice the sighash.
            reason := add(reason, 0x04)
        }
        return abi.decode(reason, (string)); // All that remains is the revert string
    }

    function _createJoinSplitsPayload(
        JoinSplit[] calldata joinSplits
    ) internal pure returns (bytes memory) {
        bytes memory joinSplitsPayload;
        uint256 numJoinSplits = joinSplits.length;
        for (uint256 i = 0; i < numJoinSplits; i++) {
            joinSplitsPayload = abi.encodePacked(
                joinSplitsPayload,
                keccak256(
                    abi.encodePacked(
                        joinSplits[i].commitmentTreeRoot,
                        joinSplits[i].nullifierA,
                        joinSplits[i].nullifierB,
                        joinSplits[i].newNoteACommitment,
                        joinSplits[i].newNoteBCommitment,
                        joinSplits[i].publicSpend,
                        joinSplits[i].encodedAsset.encodedAssetAddr,
                        joinSplits[i].encodedAsset.encodedAssetId
                    )
                )
            );
        }

        return joinSplitsPayload;
    }

    function _createRefundAssetsPayload(
        EncodedAsset[] calldata encodedRefundAssets
    ) internal pure returns (bytes memory) {
        bytes memory refundAssetsPayload;
        uint256 numRefundAssets = encodedRefundAssets.length;
        for (uint256 i = 0; i < numRefundAssets; i++) {
            refundAssetsPayload = abi.encodePacked(
                refundAssetsPayload,
                encodedRefundAssets[i].encodedAssetAddr,
                encodedRefundAssets[i].encodedAssetId
            );
        }

        return refundAssetsPayload;
    }

    function _createActionsPayload(
        Action[] calldata actions
    ) internal pure returns (bytes memory) {
        bytes memory actionsPayload;
        Action memory action;
        uint256 numActions = actions.length;
        for (uint256 i = 0; i < numActions; i++) {
            action = actions[i];
            actionsPayload = abi.encodePacked(
                actionsPayload,
                action.contractAddress,
                keccak256(action.encodedFunction)
            );
        }

        return actionsPayload;
    }
}
