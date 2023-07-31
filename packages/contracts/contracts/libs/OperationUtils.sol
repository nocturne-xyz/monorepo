// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.17;
import {Groth16} from "../libs/Groth16.sol";
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
        // compute number of joinsplits in the bundle
        uint256 totalNumJoinSplits = 0;
        uint256 numOps = ops.length;
        for (uint256 i = 0; i < numOps; i++) {
            totalNumJoinSplits += (ops[i].pubJoinSplits.length +
                ops[i].confJoinSplits.length);
        }

        proofs = new uint256[8][](totalNumJoinSplits);
        allPis = new uint256[][](totalNumJoinSplits);

        // current index into proofs and pis
        uint256 totalIndex = 0;

        // Batch verify all the joinsplit proofs
        for (uint256 j = 0; j < numOps; j++) {
            (
                uint256[8][] memory proofsForOp,
                uint256[][] memory pisForOp
            ) = extractProofsAndPisFromOperation(ops[j], digests[j]);

            for (uint256 i = 0; i < proofsForOp.length; i++) {
                proofs[totalIndex] = proofsForOp[i];
                allPis[totalIndex] = pisForOp[i];
                totalIndex++;
            }
        }

        return (proofs, allPis);
    }

    function extractProofsAndPisFromOperation(
        Operation calldata op,
        uint256 opDigest
    )
        internal
        pure
        returns (uint256[8][] memory proofs, uint256[][] memory allPis)
    {
        uint256 numJoinSplitsForOp = op.pubJoinSplits.length +
            op.confJoinSplits.length;
        proofs = new uint256[8][](numJoinSplitsForOp);
        allPis = new uint256[][](numJoinSplitsForOp);

        (
            uint256 refundAddrH1SignBit,
            uint256 refundAddrH1YCoordinate
        ) = decomposeCompressedPoint(op.refundAddr.h1);
        (
            uint256 refundAddrH2SignBit,
            uint256 refundAddrH2YCoordinate
        ) = decomposeCompressedPoint(op.refundAddr.h2);

        for (uint256 i = 0; i < numJoinSplitsForOp; i++) {
            bool isPublicJoinSplit = i < op.pubJoinSplits.length;
            if (isPublicJoinSplit) {
                // Ensure public spend > 0 for public joinsplit. Ensures handler only deals 
                // with assets that are actually unwrappable. If asset has > 0 public spend, then 
                // circuit guarantees that the _revealed_ asset is included in the tree and 
                // unwrappable. If asset has public spend = 0, circuit guarantees that the _masked_ 
                // asset is included in the tree and unwrappable, but the revealed asset for public 
                // spend = 0 is (0,0) and not unwrappable.
                require(op.pubJoinSplits[i].publicSpend > 0, "0 public spend");
            }
            
            JoinSplit calldata joinSplit = isPublicJoinSplit
                ? op.pubJoinSplits[i].joinSplit
                : op.confJoinSplits[i - op.pubJoinSplits.length];
            EncodedAsset memory encodedAsset = isPublicJoinSplit
                ? op
                    .trackedJoinSplitAssets[op.pubJoinSplits[i].assetIndex]
                    .encodedAsset
                : EncodedAsset(0, 0);
            uint256 publicSpend = isPublicJoinSplit
                ? op.pubJoinSplits[i].publicSpend
                : 0;

            uint256 encodedAssetAddrWithSignBits = encodeEncodedAssetAddrWithSignBitsPI(
                    encodedAsset.encodedAssetAddr,
                    refundAddrH1SignBit,
                    refundAddrH2SignBit
                );

            proofs[i] = joinSplit.proof;
            allPis[i] = new uint256[](12);
            allPis[i][0] = joinSplit.newNoteACommitment;
            allPis[i][1] = joinSplit.newNoteBCommitment;
            allPis[i][2] = joinSplit.commitmentTreeRoot;
            allPis[i][3] = publicSpend;
            allPis[i][4] = joinSplit.nullifierA;
            allPis[i][5] = joinSplit.nullifierB;
            allPis[i][6] = joinSplit.senderCommitment;
            allPis[i][7] = opDigest;
            allPis[i][8] = encodedAssetAddrWithSignBits;
            allPis[i][9] = encodedAsset.encodedAssetId;
            allPis[i][10] = refundAddrH1YCoordinate;
            allPis[i][11] = refundAddrH2YCoordinate;
        }
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
        uint256 handleJoinSplitGas = (op.pubJoinSplits.length +
            op.confJoinSplits.length) * GAS_PER_JOINSPLIT_HANDLE;
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
