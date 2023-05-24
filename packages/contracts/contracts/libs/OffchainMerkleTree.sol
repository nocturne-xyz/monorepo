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
    uint128 batchLenPlusOne;
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
        self.batchLenPlusOne = 1;
        self.subtreeUpdateVerifier = ISubtreeUpdateVerifier(
            subtreeUpdateVerifier
        );
        self.accumulatorQueue.initialize();

        for (uint256 i = 0; i < TreeUtils.BATCH_SIZE; i++) {
            self.batch[i] = TreeUtils.ZERO_VALUE;
        }
    }

    function insertNotes(
        OffchainMerkleTree storage self,
        EncodedNote[] memory notes
    ) internal {
        uint256 numNotes = notes.length;
        uint256[] memory noteHashes = new uint256[](numNotes);
        for (uint256 i = 0; i < numNotes; i++) {
            noteHashes[i] = TreeUtils.sha256Note(notes[i]);
        }

        _insertUpdates(self, noteHashes);
    }

    function insertNoteCommitments(
        OffchainMerkleTree storage self,
        uint256[] memory ncs
    ) internal {
        _insertUpdates(self, ncs);
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
            self.batchLenPlusOne -
            1 +
            uint128(TreeUtils.BATCH_SIZE) *
            uint128(self.accumulatorQueue.length());
    }

    function getAccumulatorHash(
        OffchainMerkleTree storage self
    ) external view returns (uint256) {
        return self.accumulatorQueue.peek();
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

    function _computeAccumulatorHash(
        OffchainMerkleTree storage self,
        uint256 batchLen
    ) internal view returns (uint256) {
        uint256[] memory batch = new uint256[](TreeUtils.BATCH_SIZE);
        for (uint256 i = 0; i < batchLen; i++) {
            batch[i] = self.batch[i];
        }
        for (uint256 i = batchLen; i < TreeUtils.BATCH_SIZE; i++) {
            batch[i] = TreeUtils.ZERO_VALUE;
        }

        return uint256(TreeUtils.sha256FieldElems(batch));
    }

    function _fillBatchWithZeros(OffchainMerkleTree storage self) internal {
        _accumulate(self, uint256(self.batchLenPlusOne) - 1);
        self.batchLenPlusOne = 1;
    }

    function _accumulate(
        OffchainMerkleTree storage self,
        uint256 batchLen
    ) internal {
        uint256 accumulatorHash = _computeAccumulatorHash(self, batchLen);
        self.accumulatorQueue.enqueue(accumulatorHash);
    }

    function _insertUpdates(
        OffchainMerkleTree storage self,
        uint256[] memory updates
    ) internal {
        uint256 batchLen = uint256(self.batchLenPlusOne) - 1;
        uint256 updatesLength = updates.length;
        uint256 updateIdx = 0;
        while (updateIdx < updatesLength) {
            self.batch[batchLen++] = updates[updateIdx++];
            if (batchLen == TreeUtils.BATCH_SIZE) {
                _accumulate(self, batchLen);
                batchLen = 0;
            }
        }

        self.batchLenPlusOne = uint128(batchLen + 1);
    }
}
