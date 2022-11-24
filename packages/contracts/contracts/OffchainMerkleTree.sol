//spdx-license-identifier: unlicense
pragma solidity ^0.8.5;

import "./interfaces/ISubtreeUpdateVerifier.sol";
import "./interfaces/IOffchainMerkleTree.sol";
import {Utils} from "./libs/Utils.sol";
import {IWallet} from "./interfaces/IWallet.sol";
import {QueueLib} from "./libs/Queue.sol";

contract OffchainMerkleTree is IOffchainMerkleTree {
    using QueueLib for QueueLib.Queue;

    // number of non-zero leaves in the tree
    // INVARIANT: bottom `LOG2_BATCH_SIZE` bits of `count` should all be zero
    uint128 public _count;
    // number of leaves in the batch
    // when this gets to Utils.BATCH_SIZE, we compute accumulatorHash and push te the accumulatorQueue
    uint128 public batchLen;

    // root of the merkle tree
    uint256 public _root;

    // buffer containing uncommitted update hashes
    // each hash can either be the sha256 hash of a publically revealed note (e.g. in thecase of a deposit)
    // or the note commitment (i.e. poseidon hash computed off-chain) of a note that hasn't been revealed
    // when the buffer is filled, the sha256 hash of the batch is pushed to the accumulatorQueue, "accumulating" the batch of updates
    // ! solidity doesn't allow us to use `Utils.BATCH_SIZE` here unfortunately.
    uint256[16] public batch;

    // queue containing accumulator hashes of batches of updates
    // each accumulator commits to an update (a set of note commitments) that will be applied to the tree
    // via the commitSubtree() method
    QueueLib.Queue public accumulatorQueue;

    ISubtreeUpdateVerifier public subtreeUpdateVerifier;

    event InsertNoteCommitments(uint256[] commitments);

    event InsertNotes(IWallet.Note[] notes);

    constructor(address _subtreeUpdateVerifier) {
        // root starts as the root of the empty depth-32 tree.
        _root = Utils.EMPTY_TREE_ROOT;
        _count = 0;
        batchLen = 0;
        subtreeUpdateVerifier = ISubtreeUpdateVerifier(_subtreeUpdateVerifier);

        accumulatorQueue.initialize();
    }

    // returns the current root of the tree
    function root() external view override returns (uint256) {
        return _root;
    }

    // returns the current number of leaves in the tree
    function count() external view override returns (uint128) {
        return _count;
    }

    function totalCount() external view override returns (uint128) {
        return
            _count +
            batchLen +
            uint128(Utils.BATCH_SIZE) *
            uint128(accumulatorQueue.length());
    }

    function computeAccumulatorHash() internal view returns (uint256) {
        require(batchLen == Utils.BATCH_SIZE, "batchLen != Utils.BATCH_SIZE");

        uint256[] memory _batch = new uint256[](Utils.BATCH_SIZE);
        for (uint256 i = 0; i < Utils.BATCH_SIZE; i++) {
            _batch[i] = batch[i];
        }

        return uint256(Utils.sha256FieldElems(_batch));
    }

    function accumulate() internal {
        require(batchLen == Utils.BATCH_SIZE, "batchLen != Utils.BATCH_SIZE");

        uint256 accumulatorHash = computeAccumulatorHash();
        accumulatorQueue.enqueue(accumulatorHash);
        batchLen = 0;
    }

    function applySubtreeUpdate(uint256 newRoot, uint256[8] calldata proof)
        external
        override
    {
        require(!accumulatorQueue.isEmpty(), "accumulatorQueue is empty");

        uint256 accumulatorHash = accumulatorQueue.peek();
        (uint256 hi, uint256 lo) = Utils.uint256ToFieldElemLimbs(
            accumulatorHash
        );
        uint256 encodedPathAndHash = Utils.encodePathAndHash(_count, hi);

        require(
            subtreeUpdateVerifier.verifyProof(
                [proof[0], proof[1]],
                [[proof[2], proof[3]], [proof[4], proof[5]]],
                [proof[6], proof[7]],
                [_root, newRoot, encodedPathAndHash, lo]
            ),
            "subtree update proof invalid"
        );

        accumulatorQueue.dequeue();
        _root = newRoot;
        _count += uint128(Utils.BATCH_SIZE);
    }

    function _insertUpdates(uint256[] memory updates) internal {
        for (uint256 i = 0; i < updates.length; i++) {
            batch[batchLen] = updates[i];
            batchLen += 1;

            if (batchLen == Utils.BATCH_SIZE) {
                accumulate();
            }
        }
    }

    function _insertNotes(IWallet.Note[] memory notes) internal {
        uint256[] memory hashes = new uint256[](notes.length);
        for (uint256 i = 0; i < notes.length; i++) {
            hashes[i] = Utils.sha256Note(notes[i]);
        }

        _insertUpdates(hashes);
        emit InsertNotes(notes);
    }

    function insertNotes(IWallet.Note[] memory notes) external override {
        _insertNotes(notes);
    }

    function insertNote(IWallet.Note memory note) external override {
        IWallet.Note[] memory notes = new IWallet.Note[](1);
        notes[0] = note;
        _insertNotes(notes);
    }

    function _insertNoteCommitments(uint256[] memory ncs) internal {
        _insertUpdates(ncs);
        emit InsertNoteCommitments(ncs);
    }

    function insertNoteCommitments(uint256[] memory ncs) external override {
        _insertNoteCommitments(ncs);
    }

    function insertNoteCommitment(uint256 nc) external override {
        uint256[] memory ncs = new uint256[](1);
        ncs[0] = nc;
        _insertNoteCommitments(ncs);
    }
}
