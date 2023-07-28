//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "../interfaces/ISubtreeUpdateVerifier.sol";
import {Groth16} from "../libs/Groth16.sol";
import "../libs/Types.sol";
import {ITeller} from "../interfaces/ITeller.sol";
import {ISubtreeUpdateVerifier} from "../interfaces/ISubtreeUpdateVerifier.sol";
import {Utils} from "./Utils.sol";
import {TreeUtils} from "./TreeUtils.sol";
import {QueueLib} from "./Queue.sol";

struct OffchainMerkleTree {
    // number of non-zero leaves in the tree
    // INVARIANT: bottom `LOG2_BATCH_SIZE` bits of `count` should all be zero
    uint128 count;
    // number of leaves in the batch, plus one
    // when this gets to TreeUtils.BATCH_SIZE + 1, we compute accumulatorHash and push te the accumulatorQueue
    // we store batch size + 1 to avoid "clearing" the storage slot and save gas
    uint64 batchLenPlusOne;
    // a bitmap representing whether or not each leaf in the batch is a note or a note commitment
    // the bitmap is kept in big-endian order
    // that is, the bit corresponding to the 0th leaf in the batch is the "leftmost bit" of the bitmap, i.e. the bit with value 2^63
    // and hte bit corresponding to the ith leaf in the batch is the bit with value 2^(63 - i)
    // 0 = note commitment, 1 = note
    uint64 bitmap;
    // root of the merkle tree
    uint256 root;
    // buffer containing uncommitted update hashes
    // each hash can either be the sha256 hash of a publically revealed note (e.g. in thecase of a deposit)
    // or the note commitment (i.e. poseidon hash computed off-chain) of a note that hasn't been revealed
    // when the buffer is filled, the sha256 hash of the batch is pushed to the accumulatorQueue, "accumulating" the batch of updates
    // ! solidity doesn't allow us to use `TreeUtils.BATCH_SIZE` here unfortunately.
    uint256[16] batch;
    // queue containing accumulator hashes of batches of updates
    // each accumulator commits to an update (a set of note commitments) that will be applied to the tree
    // via the commitSubtree() method
    QueueLib.Queue accumulatorQueue;
    ISubtreeUpdateVerifier subtreeUpdateVerifier;
}

library LibOffchainMerkleTree {
    using QueueLib for QueueLib.Queue;

    function initialize(
        OffchainMerkleTree storage self,
        address subtreeUpdateVerifier
    ) internal {
        // root starts as the root of the empty depth-32 tree.
        self.root = TreeUtils.EMPTY_TREE_ROOT;
        self.count = 0;
        self.bitmap = 0;
        _setBatchLen(self, 0);

        self.subtreeUpdateVerifier = ISubtreeUpdateVerifier(
            subtreeUpdateVerifier
        );
        self.accumulatorQueue.initialize();

        for (uint256 i = 0; i < TreeUtils.BATCH_SIZE; i++) {
            self.batch[i] = TreeUtils.ZERO_VALUE;
        }
    }

    function insertNote(
        OffchainMerkleTree storage self,
        EncodedNote memory note
    ) internal {
        uint256 noteHash = TreeUtils.sha256Note(note);
        _insertUpdate(self, noteHash, true);
    }

    function insertNoteCommitments(
        OffchainMerkleTree storage self,
        uint256[] memory ncs
    ) internal {
        for (uint256 i = 0; i < ncs.length; i++) {
            _insertUpdate(self, ncs[i], false);
        }
    }

    function applySubtreeUpdate(
        OffchainMerkleTree storage self,
        uint256 newRoot,
        uint256[8] memory proof
    ) internal {
        uint256[] memory pis = _calculatePublicInputs(self, newRoot);

        require(
            self.subtreeUpdateVerifier.verifyProof(proof, pis),
            "subtree update proof invalid"
        );

        self.accumulatorQueue.dequeue();
        self.root = newRoot;
        self.count += uint128(TreeUtils.BATCH_SIZE);
    }

    // returns the current root of the tree
    function getRoot(
        OffchainMerkleTree storage self
    ) internal view returns (uint256) {
        return self.root;
    }

    // returns the current number of leaves in the tree
    function getCount(
        OffchainMerkleTree storage self
    ) internal view returns (uint128) {
        return self.count;
    }

    // returns the number of leaves in the tree plus the number of leaves waiting in the queue
    function getTotalCount(
        OffchainMerkleTree storage self
    ) internal view returns (uint128) {
        return
            self.count +
            uint128(getBatchLen(self)) +
            uint128(TreeUtils.BATCH_SIZE) *
            uint128(self.accumulatorQueue.length());
    }

    function getAccumulatorHash(
        OffchainMerkleTree storage self
    ) external view returns (uint256) {
        return self.accumulatorQueue.peek();
    }

    function getBatchLen(
        OffchainMerkleTree storage self
    ) internal view returns (uint64) {
        return self.batchLenPlusOne - 1;
    }

    function _setBatchLen(
        OffchainMerkleTree storage self,
        uint64 batchLen
    ) internal {
        self.batchLenPlusOne = batchLen + 1;
    }

    function _calculatePublicInputs(
        OffchainMerkleTree storage self,
        uint256 newRoot
    ) internal view returns (uint256[] memory) {
        uint256 accumulatorHash = self.accumulatorQueue.peek();
        (uint256 hi, uint256 lo) = TreeUtils.uint256ToFieldElemLimbs(
            accumulatorHash
        );
        uint256 encodedPathAndHash = TreeUtils.encodePathAndHash(
            self.count,
            hi
        );

        uint256[] memory pis = new uint256[](4);
        pis[0] = self.root;
        pis[1] = newRoot;
        pis[2] = encodedPathAndHash;
        pis[3] = lo;

        return pis;
    }

    // H(updates || bitmap)
    function _computeAccumulatorHash(
        OffchainMerkleTree storage self
    ) internal view returns (uint256) {
        uint256 batchLen = getBatchLen(self);
        uint256[] memory accumulatorInputs = new uint256[](
            TreeUtils.BATCH_SIZE + 1
        );
        for (uint256 i = 0; i < batchLen; i++) {
            accumulatorInputs[i] = self.batch[i];
        }
        for (uint256 i = batchLen; i < TreeUtils.BATCH_SIZE; i++) {
            accumulatorInputs[i] = TreeUtils.ZERO_VALUE;
        }

        // shift over to pad input out to a multiple of 256 bits
        accumulatorInputs[TreeUtils.BATCH_SIZE] = uint256(self.bitmap) << 192;

        return uint256(TreeUtils.sha256U256ArrayBE(accumulatorInputs));
    }

    function fillBatchWithZeros(OffchainMerkleTree storage self) internal {
        _accumulateAndResetBatchLen(self);
    }

    function _accumulateAndResetBatchLen(
        OffchainMerkleTree storage self
    ) internal {
        uint256 accumulatorHash = _computeAccumulatorHash(self);
        self.accumulatorQueue.enqueue(accumulatorHash);
        self.bitmap = 0;
        _setBatchLen(self, 0);
    }

    function _insertUpdate(
        OffchainMerkleTree storage self,
        uint256 update,
        bool isNote
    ) internal {
        uint64 batchLen = getBatchLen(self);
        self.batch[batchLen] = update;

        self.bitmap |= isNote ? uint64(1) << (63 - batchLen) : uint64(0);

        uint64 newBatchLen = batchLen + 1;
        _setBatchLen(self, newBatchLen);

        if (newBatchLen == TreeUtils.BATCH_SIZE) {
            _accumulateAndResetBatchLen(self);
        }
    }
}
