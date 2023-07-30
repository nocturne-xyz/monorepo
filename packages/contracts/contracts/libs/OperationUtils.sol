// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.17;
import {Groth16} from "../libs/Groth16.sol";
import "../libs/Types.sol";

// Helpers for extracting data / formatting operations
library OperationUtils {
    uint256 constant COMPRESSED_POINT_SIGN_MASK = 1 << 254;

    //@requires(1) `ops.length == digests.length`
    //@requires(2) for all i in 0..ops.length: `digests[i]` is the correct operation digest for `ops[i]`
    //@ensures(1) every PI array in allPis satisfies extractProofsAndPisFromOperation.ensures(...)
    //@ensures(2) proofs is the result of concatenating the `proofs` arrays gotten from `extractProofsAndPisFromOperation` for each `op` in `ops`
    //@ensures(3) allPis is the result of concatenating the `allPis` arrays gotten from `extractProofsAndPisFromOperation` for each `op` in `ops`
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

    //@requires(1) opDigest is the correct operation digest for op
    // let n be the number of joinsplits in op
    //@ensures(1) for i in 0..n: except for opDigest, refundAddr, and asset info in the case of 0 publicSpend, allPis[i] contains only values derived from the ith JoinSplit specified op,
    //  and therefore is committed to by OpDigest
    //@ensures(2) for i in 0..n: proofs[i] comes from the ith JoinSplit specified in the op,
    //  and therefore is committed to by OpDigest
    //@ensures(3) for i in 0..n: allPis[i][7] is the correct `opDigest` for `op`
    //@ensures(4) for i in 0..n: allPis[i][10..11], together with the sign bits in encodedAssetAddrWithSignBits,
    //  are the correct compressed version of `op.refundAddr` if `op.refundAddr` is a valid compressed point
    function extractProofsAndPisFromOperation(
        Operation calldata op,
        uint256 opDigest
    )
        internal
        pure
        returns (uint256[8][] memory proofs, uint256[][] memory allPis)
    {
        uint256 numJoinSplitsForOp = OperationLib.totalNumJoinSplits(op);
        proofs = new uint256[8][](numJoinSplitsForOp);
        allPis = new uint256[][](numJoinSplitsForOp);

        //@lemma(1) `(refundAddrH1SignBit, refundAddrH1YCoordinate)` represents she x coordinate's sign bit and y coordinate of
        //  `op.refundAddr.h1` if `op.refundAddr` is a valid compressed point
        //@argument follows from decomposeCompressedPoint.ensures(...), which holds if
        //   decomposedCompressedPoint.requires(...) is true (i.e. `op.refundAddr` is a valid compressed point)
        (
            uint256 refundAddrH1SignBit,
            uint256 refundAddrH1YCoordinate
        ) = decomposeCompressedPoint(op.refundAddr.h1);
        //@lemma(2) `(refundAddrH2SignBit, refundAddrH2YCoordinate)` is the correct decomposition of `op.refundAddr.h1` if `op.refundAddr` is a valid compressed point
        //@argument same as lemma(1)
        (
            uint256 refundAddrH2SignBit,
            uint256 refundAddrH2YCoordinate
        ) = decomposeCompressedPoint(op.refundAddr.h2);

        for (uint256 i = 0; i < numJoinSplitsForOp; i++) {
            bool isPublicJoinSplit = i < op.pubJoinSplits.length;
            JoinSplit calldata joinSplit = isPublicJoinSplit
                ? op.pubJoinSplits[i].joinSplit
                : op.confJoinSplits[i - op.pubJoinSplits.length];
            EncodedAsset memory encodedAsset = isPublicJoinSplit
                ? op.trackedAssets[op.pubJoinSplits[i].assetIndex].encodedAsset
                : EncodedAsset(0, 0);
            uint256 publicSpend = isPublicJoinSplit
                ? op.pubJoinSplits[i].publicSpend
                : 0;

            uint256 encodedAssetAddrWithSignBits = encodeEncodedAssetAddrWithSignBitsPI(
                    encodedAsset.encodedAssetAddr,
                    refundAddrH1SignBit,
                    refundAddrH2SignBit
                );

            //@satisfies(1)
            //@argument all PIs except for OpDigest, refundAddr, encodedAsset.encodedAssetId,
            // and encodedAssetAddrWithSignBits come from the JoinSplit, and
            // the only case where asset info doesn't come from JoinSplit is it's not a public JoinSplit,
            // in which case publicSpend is 0
            //@satisfies(2)
            //@argument clearly true by construction (exactly what code does)
            //@satisfies(3)
            //@argument @requires(1) ensures `opDigest` is the correct operation digest for `op`,
            // so (3) is clearly true by construction (exactly what code does)
            //@ensures(4)
            //@argument follows from `encodeEncodedAssetAddrWithSignBitsPI.ensures(1)`, lemma(1), and lemma(2)
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
    //@requires(1) compressedPoint is a valid compressed point
    //@ensures(1) sign is the sign bit of the x coordinate
    //@ensures(2) y is the y coordinate
    function decomposeCompressedPoint(
        uint256 compressedPoint
    ) internal pure returns (uint256 sign, uint256 y) {
        //@satsifes(1, 2) clearly true by construction (exactly what code does)
        sign = (compressedPoint & COMPRESSED_POINT_SIGN_MASK) >> 254;
        y = compressedPoint & (COMPRESSED_POINT_SIGN_MASK - 1);
        return (sign, y);
    }

    //@requires(1) h1SignBit is 0 or 1
    //@requires(2) h2SignBit is 0 or 1
    //@ensures(3) return value is the correct encoding of `encodedAssetAddr` with sign bits `h1SignBit` and `h2SignBit`
    //  according to the circuit spec if `encodedAssetAddr` is correctly encoded
    function encodeEncodedAssetAddrWithSignBitsPI(
        uint256 encodedAssetAddr,
        uint256 h1SignBit,
        uint256 h2SignBit
    ) internal pure returns (uint256) {
        //@satisfies(3) clearly true from @requires(1), @requires(2), and by construction,
        // as spec indicates `h1`'s sign bit should be at bit 248 and `h2`'s sign bit should be at bit 249
        return encodedAssetAddr | (h1SignBit << 248) | (h2SignBit << 249);
    }

    function calculateBundlerGasAssetPayout(
        Operation calldata op,
        OperationResult memory opResult
    ) internal pure returns (uint256) {
        uint256 handleJoinSplitGas = OperationLib.totalNumJoinSplits(op) *
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
