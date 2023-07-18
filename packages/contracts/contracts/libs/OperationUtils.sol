// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.17;
import {Groth16} from "../libs/Groth16.sol";
import {Utils} from "../libs/Utils.sol";
import "../libs/Types.sol";

// Helpers for extracting data / formatting operations
library OperationUtils {
    uint256 constant COMPRESSED_POINT_SIGN_MASK = 1 << 254;

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

            (
                uint256 refundAddrH1SignBit,
                uint256 refundAddrH1YCoordinate
            ) = decomposeCompressedPoint(op.refundAddr.h1);
            (
                uint256 refundAddrH2SignBit,
                uint256 refundAddrH2YCoordinate
            ) = decomposeCompressedPoint(op.refundAddr.h2);

            uint256 numJoinSplitsForOp = op.joinSplits.length;
            for (uint256 j = 0; j < numJoinSplitsForOp; j++) {
                uint256 encodedAssetAddrWithSignBits = encodeEncodedAssetAddrWithSignBitsPI(
                        op.joinSplits[j].encodedAsset.encodedAssetAddr,
                        refundAddrH1SignBit,
                        refundAddrH2SignBit
                    );

                proofs[index] = op.joinSplits[j].proof;
                allPis[index] = new uint256[](12);
                allPis[index][0] = op.joinSplits[j].newNoteACommitment;
                allPis[index][1] = op.joinSplits[j].newNoteBCommitment;
                allPis[index][2] = op.joinSplits[j].commitmentTreeRoot;
                allPis[index][3] = op.joinSplits[j].publicSpend;
                allPis[index][4] = op.joinSplits[j].nullifierA;
                allPis[index][5] = op.joinSplits[j].nullifierB;
                allPis[index][6] = op.joinSplits[j].senderCommitment;
                allPis[index][7] = digests[i];
                allPis[index][8] = encodedAssetAddrWithSignBits;
                allPis[index][9] = op.joinSplits[j].encodedAsset.encodedAssetId;
                allPis[index][10] = refundAddrH1YCoordinate;
                allPis[index][11] = refundAddrH2YCoordinate;
                index++;
            }
        }

        return (proofs, allPis);
    }

    // takes a compressed point and extracts the sign bit and y coordinate
    // returns (sign, y)
    function decomposeCompressedPoint(
        uint256 compressedPoint
    ) internal pure returns (uint256 sign, uint256 y) {
        sign = (compressedPoint & COMPRESSED_POINT_SIGN_MASK) >> 254;
        y = compressedPoint & (COMPRESSED_POINT_SIGN_MASK - 1);
        return (sign, y);
    }

    function encodeEncodedAssetAddrWithSignBitsPI(
        uint256 encodedAssetAddr,
        uint256 c1SignBit,
        uint256 c2SignBit
    ) internal pure returns (uint256) {
        return encodedAssetAddr | (c1SignBit << 248) | (c2SignBit << 249);
    }

    function calculateBundlerGasAssetPayout(
        Operation calldata op,
        OperationResult memory opResult
    ) internal pure returns (uint256) {
        uint256 handleJoinSplitGas = op.joinSplits.length *
            GAS_PER_JOINSPLIT_HANDLE;
        uint256 refundGas = opResult.numRefunds *
            (GAS_PER_REFUND_HANDLE + GAS_PER_REFUND_TREE);

        return
            op.gasPrice *
            (opResult.verificationGas +
                handleJoinSplitGas +
                opResult.executionGas +
                refundGas);
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
}
