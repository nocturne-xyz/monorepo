//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "../interfaces/ISubtreeUpdateVerifier.sol";
import {Groth16} from "../libs/Groth16.sol";
import "../libs/Types.sol";
import {IWallet} from "../interfaces/IWallet.sol";
import {ISubtreeUpdateVerifier} from "../interfaces/ISubtreeUpdateVerifier.sol";
import {Utils} from "./Utils.sol";
import {TreeUtils} from "./TreeUtils.sol";
import {QueueLib} from "./Queue.sol";

struct OffchainMerkleTreeData {
    // number of non-zero leaves in the tree
    // INVARIANT: bottom `LOG2_BATCH_SIZE` bits of `count` should all be zero
    uint128 count;
    // number of leaves in the batch
    // when this gets to TreeUtils.BATCH_SIZE, we compute accumulatorHash and push te the accumulatorQueue
    uint128 batchLen;
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

library OffchainMerkleTree {
    using QueueLib for QueueLib.Queue;

    function initialize(
        OffchainMerkleTreeData storage self,
        address subtreeUpdateVerifier
    ) internal {
        // root starts as the root of the empty depth-32 tree.
        self.root = TreeUtils.EMPTY_TREE_ROOT;
        self.count = 0;
        self.batchLen = 0;
        self.subtreeUpdateVerifier = ISubtreeUpdateVerifier(
            subtreeUpdateVerifier
        );
        self.accumulatorQueue.initialize();
    }

    function insertNotes(
        OffchainMerkleTreeData storage self,
        EncodedNote[] memory notes
    ) internal {
        uint256[] memory hashes = new uint256[](notes.length);
        for (uint256 i = 0; i < notes.length; i++) {
            hashes[i] = Utils.sha256Note(notes[i]);
        }

        _insertUpdates(self, hashes);
    }

    function insertNote(
        OffchainMerkleTreeData storage self,
        EncodedNote memory note
    ) internal {
        EncodedNote[] memory notes = new EncodedNote[](1);
        notes[0] = note;
        insertNotes(self, notes);
    }

    function insertNoteCommitments(
        OffchainMerkleTreeData storage self,
        uint256[] memory ncs
    ) internal {
        _insertUpdates(self, ncs);
    }

    function insertNoteCommitment(
        OffchainMerkleTreeData storage self,
        uint256 nc
    ) internal {
        uint256[] memory ncs = new uint256[](1);
        ncs[0] = nc;
        insertNoteCommitments(self, ncs);
    }

    function applySubtreeUpdate(
        OffchainMerkleTreeData storage self,
        uint256 newRoot,
        uint256[8] memory proof
    ) internal {
        uint256[] memory pis = _calculatePublicInputs(self, newRoot);

        require(
            self.subtreeUpdateVerifier.verifyProof(
                Utils.proof8ToStruct(proof),
                pis
            ),
            "subtree update proof invalid"
        );

        self.accumulatorQueue.dequeue();
        self.root = newRoot;
        self.count += uint128(TreeUtils.BATCH_SIZE);
    }

    // returns the current root of the tree
    function getRoot(
        OffchainMerkleTreeData storage self
    ) internal view returns (uint256) {
        return self.root;
    }

    // returns the current number of leaves in the tree
    function getCount(
        OffchainMerkleTreeData storage self
    ) internal view returns (uint128) {
        return self.count;
    }

    // returns the number of leaves in the tree plus the number of leaves waiting in the queue
    function getTotalCount(
        OffchainMerkleTreeData storage self
    ) internal view returns (uint128) {
        return
            self.count +
            self.batchLen +
            uint128(TreeUtils.BATCH_SIZE) *
            uint128(self.accumulatorQueue.length());
    }

    function _calculatePublicInputs(
        OffchainMerkleTreeData storage self,
        uint256 newRoot
    ) internal view returns (uint256[] memory) {
        uint256 accumulatorHash = self.accumulatorQueue.peek();
        (uint256 hi, uint256 lo) = Utils.uint256ToFieldElemLimbs(
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
        OffchainMerkleTreeData storage self
    ) private view returns (uint256) {
        require(
            self.batchLen == TreeUtils.BATCH_SIZE,
            "batchLen != TreeUtils.BATCH_SIZE"
        );

        uint256[] memory batch = new uint256[](TreeUtils.BATCH_SIZE);
        for (uint256 i = 0; i < TreeUtils.BATCH_SIZE; i++) {
            batch[i] = self.batch[i];
        }

        return uint256(Utils.sha256FieldElems(batch));
    }

    function _accumulate(OffchainMerkleTreeData storage self) private {
        require(
            self.batchLen == TreeUtils.BATCH_SIZE,
            "batchLen != TreeUtils.BATCH_SIZE"
        );

        uint256 accumulatorHash = _computeAccumulatorHash(self);
        self.accumulatorQueue.enqueue(accumulatorHash);
        self.batchLen = 0;
    }

    function _insertUpdates(
        OffchainMerkleTreeData storage self,
        uint256[] memory updates
    ) private {
        for (uint256 i = 0; i < updates.length; i++) {
            self.batch[self.batchLen] = updates[i];
            self.batchLen += 1;

            if (self.batchLen == TreeUtils.BATCH_SIZE) {
                _accumulate(self);
            }
        }
    }
}
