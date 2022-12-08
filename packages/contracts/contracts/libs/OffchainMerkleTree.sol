//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.5;

import "../interfaces/ISubtreeUpdateVerifier.sol";
import {IWallet} from "../interfaces/IWallet.sol";
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
        address _subtreeUpdateVerifier
    ) internal {
        // root starts as the root of the empty depth-32 tree.
        self.root = TreeUtils.EMPTY_TREE_ROOT;
        self.count = 0;
        self.batchLen = 0;
        self.subtreeUpdateVerifier = ISubtreeUpdateVerifier(
            _subtreeUpdateVerifier
        );
        self.accumulatorQueue.initialize();
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

    function computeAccumulatorHash(
        OffchainMerkleTreeData storage self
    ) internal view returns (uint256) {
        require(
            self.batchLen == TreeUtils.BATCH_SIZE,
            "batchLen != TreeUtils.BATCH_SIZE"
        );

        uint256[] memory _batch = new uint256[](TreeUtils.BATCH_SIZE);
        for (uint256 i = 0; i < TreeUtils.BATCH_SIZE; i++) {
            _batch[i] = self.batch[i];
        }

        return uint256(Utils.sha256FieldElems(_batch));
    }

    function accumulate(OffchainMerkleTreeData storage self) internal {
        require(
            self.batchLen == TreeUtils.BATCH_SIZE,
            "batchLen != TreeUtils.BATCH_SIZE"
        );

        uint256 _accumulatorHash = computeAccumulatorHash(self);
        self.accumulatorQueue.enqueue(_accumulatorHash);
        self.batchLen = 0;
    }

    function applySubtreeUpdate(
        OffchainMerkleTreeData storage self,
        uint256 _newRoot,
        uint256[8] memory _proof
    ) internal {
        require(!self.accumulatorQueue.isEmpty(), "accumulatorQueue is empty");

        uint256 _accumulatorHash = self.accumulatorQueue.peek();
        (uint256 _hi, uint256 _lo) = Utils.uint256ToFieldElemLimbs(
            _accumulatorHash
        );
        uint256 _encodedPathAndHash = TreeUtils.encodePathAndHash(
            self.count,
            _hi
        );

        require(
            self.subtreeUpdateVerifier.verifyProof(
                [_proof[0], _proof[1]],
                [[_proof[2], _proof[3]], [_proof[4], _proof[5]]],
                [_proof[6], _proof[7]],
                [self.root, _newRoot, _encodedPathAndHash, _lo]
            ),
            "subtree update proof invalid"
        );

        self.accumulatorQueue.dequeue();
        self.root = _newRoot;
        self.count += uint128(TreeUtils.BATCH_SIZE);
    }

    function insertUpdates(
        OffchainMerkleTreeData storage self,
        uint256[] memory _updates
    ) internal {
        for (uint256 i = 0; i < _updates.length; i++) {
            self.batch[self.batchLen] = _updates[i];
            self.batchLen += 1;

            if (self.batchLen == TreeUtils.BATCH_SIZE) {
                accumulate(self);
            }
        }
    }

    function insertNotes(
        OffchainMerkleTreeData storage self,
        IWallet.Note[] memory _notes
    ) internal {
        uint256[] memory _hashes = new uint256[](_notes.length);
        for (uint256 i = 0; i < _notes.length; i++) {
            _hashes[i] = Utils.sha256Note(_notes[i]);
        }

        insertUpdates(self, _hashes);
    }

    function insertNote(
        OffchainMerkleTreeData storage self,
        IWallet.Note memory _note
    ) internal {
        IWallet.Note[] memory _notes = new IWallet.Note[](1);
        _notes[0] = _note;
        insertNotes(self, _notes);
    }

    function insertNoteCommitments(
        OffchainMerkleTreeData storage self,
        uint256[] memory _ncs
    ) internal {
        insertUpdates(self, _ncs);
    }

    function insertNoteCommitment(
        OffchainMerkleTreeData storage self,
        uint256 _nc
    ) internal {
        uint256[] memory _ncs = new uint256[](1);
        _ncs[0] = _nc;
        insertNoteCommitments(self, _ncs);
    }
}
