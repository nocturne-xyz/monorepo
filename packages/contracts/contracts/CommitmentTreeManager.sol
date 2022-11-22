// SPDX-License-Identifier: MIT
pragma solidity ^0.8.5;

import "./interfaces/ISpend2Verifier.sol";
import "./interfaces/ISubtreeUpdateVerifier.sol";
import {IWallet} from "./interfaces/IWallet.sol";

import {QueueLib} from "./libs/Queue.sol";
import {FieldUtils} from "./libs/FieldUtils.sol";
import {IHasherT3} from "./interfaces/IHasher.sol";

contract CommitmentTreeManager {
    using QueueLib for QueueLib.Queue;

	uint256 public constant ZERO = 0;
    uint256 public constant LOG2_BATCH_SIZE = 4;
    uint256 public constant BATCH_SIZE = 1 << LOG2_BATCH_SIZE;
    uint256 public constant LOG2_DEPTH = 5;
    uint256 public constant DEPTH = 1 << LOG2_DEPTH;
    uint256 public constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    // number of non-zero leaves in the tree
    // INVARIANT: bottom `LOG2_BATCH_SIZE` bits of `count` should all be zero
    uint128 public count;
    // number of leaves in the batch
    // when this gets to BATCH_SIZE, we compute accumulatorHash and push te the queue
    uint128 public batchLen;

    // root of the merkle tree
    uint256 public root;

    // current batch of updates to accumulate
    uint256[BATCH_SIZE] public batch;

    // queue containing accumulators of uncommitted updates
    QueueLib.Queue public queue;

    // past roots of the merkle tree
    mapping(uint256 => bool) public pastRoots;


    mapping(uint256 => bool) public nullifierSet;
    uint256 public nonce;

    ISpend2Verifier public spend2Verifier;
    ISubtreeUpdateVerifier public subtreeUpdateVerifier;



    event Refund(
        IWallet.FLAXAddress refundAddr,
        uint256 indexed nonce,
        address indexed asset,
        uint256 indexed id,
        uint256 value,
        uint256 merkleIndex
    );

    event Spend(
        uint256 indexed oldNoteNullifier,
        uint256 indexed valueSpent,
        uint256 indexed merkleIndex
    );

    event InsertNoteCommitments(
        uint256[] commitments
    );

    event InsertNotes(
        IWallet.Note[] notes
    );

    constructor(
        address _spend2verifier,
        address _subtreeUpdateVerifier,
        address _hasherT3
    ) {
        spend2Verifier = ISpend2Verifier(_spend2verifier);

        root = ZERO;
        count = 0;
        batchLen = 0;
        subtreeUpdateVerifier = ISubtreeUpdateVerifier(_subtreeUpdateVerifier);

        // compute the initial root corresponding to the tree of depth `depth` containing all zeros
        IHasherT3 hasher = IHasherT3(_hasherT3);
        for (uint256 i = 0; i < DEPTH; i++) {
            root = hasher.hash([root, root]);
        }

        pastRoots[root] = true;

        queue.initialize();
    }

    function computeAccumulatorHash() internal view returns (uint256) {
        require(batchLen == BATCH_SIZE, "batchLen != BATCH_SIZE");

        uint256[] memory _batch = new uint256[](BATCH_SIZE);
        for (uint256 i = 0; i < BATCH_SIZE; i++) {
            _batch[i] = batch[i];
        }

        return FieldUtils.sha256FieldElemsToUint256(_batch);
    }

    function accumulate() internal {
        require(batchLen == BATCH_SIZE, "batchLen != BATCH_SIZE");

        uint256 accumulatorHash = computeAccumulatorHash();
        queue.enqueue(accumulatorHash);
        batchLen = 0;
    }

    function _totalCount() internal view returns (uint256) {
        return uint256(count) + batchLen + BATCH_SIZE * queue.length();
    }

    function totalCount() external view returns (uint128) {
        return uint128(_totalCount());
    }

    function getRoot() external view returns (uint256) {
        return root;
    }

    function insertComOrAccToQueue(uint256 _hash) internal {
        batch[batchLen] = _hash;
        batchLen += 1;

        if (batchLen == BATCH_SIZE) {
            accumulate();
        }

        uint256[] memory hashes = new uint256[](1);
        hashes[0] = _hash;
    }

    function insertComsOrAccsToQueue(uint256[] memory hashes) internal {
        for (uint256 i = 0; i < hashes.length; i++) {
            batch[batchLen] = hashes[i];
            batchLen += 1;

            if (batchLen == BATCH_SIZE) {
                accumulate();
            }
        }
    }

    function insertNoteCommitment(uint256 commitment) internal {
        insertComOrAccToQueue(commitment);

        uint256[] memory comms = new uint256[](1);
        emit InsertNoteCommitments(comms);
    }

    function insertNoteCommitments(uint256[] memory commitments) internal {
        insertComsOrAccsToQueue(commitments);
        emit InsertNoteCommitments(commitments);
    }

    function hashNote(
        IWallet.Note memory note
    ) internal pure returns (uint256) {
        uint256[] memory elems = new uint256[](6);
        elems[0] = note.ownerH1;
        elems[1] = note.ownerH2;
        elems[2] = note.nonce;
        elems[3] = note.asset;
        elems[4] = note.id;
        elems[5] = note.value;
        return FieldUtils.sha256FieldElemsToUint256(elems);
    }

    function insertNote(
        IWallet.Note memory note
    ) internal {
        uint256 accumulator = hashNote(note);
        insertComOrAccToQueue(accumulator);

        IWallet.Note[] memory notes = new IWallet.Note[](1);
        notes[0] = note;

        emit InsertNotes(notes);
    }

    function insertNotes(
        IWallet.Note[] memory notes
    ) internal {
        for (uint256 i = 0; i < notes.length; i++) {
            uint256 accumulator = hashNote(notes[i]);
            insertComOrAccToQueue(accumulator);
        }
        emit InsertNotes(notes);
    }

    // TODO: add default noteCommitment for when there is no output note.
    function _handleSpend(
        IWallet.SpendTransaction calldata spendTx,
        bytes32 operationHash
    ) internal {
        require(
            pastRoots[spendTx.commitmentTreeRoot],
            "Given tree root not a past root"
        );
        require(!nullifierSet[spendTx.nullifier], "Nullifier already used");

        bytes32 spendHash = _hashSpend(spendTx);
        uint256 operationDigest = uint256(
            keccak256(abi.encodePacked(operationHash, spendHash))
        ) % SNARK_SCALAR_FIELD;

        require(
            spend2Verifier.verifyProof(
                [spendTx.proof[0], spendTx.proof[1]],
                [
                    [spendTx.proof[2], spendTx.proof[3]],
                    [spendTx.proof[4], spendTx.proof[5]]
                ],
                [spendTx.proof[6], spendTx.proof[7]],
                [
                    spendTx.newNoteCommitment,
                    spendTx.commitmentTreeRoot,
                    uint256(uint160(spendTx.asset)),
                    spendTx.id,
                    spendTx.valueToSpend,
                    spendTx.nullifier,
                    operationDigest
                ]
            ),
            "Spend proof invalid"
        );

        insertComOrAccToQueue(spendTx.newNoteCommitment);
        nullifierSet[spendTx.nullifier] = true;

        emit Spend(
            spendTx.nullifier,
            spendTx.valueToSpend,
            _totalCount() - 1
        );
    }

    function _handleRefund(
        IWallet.FLAXAddress memory refundAddr,
        address asset,
        uint256 id,
        uint256 value
    ) internal {
        IWallet.Note memory note;
        note.ownerH1 = refundAddr.h1X;
        note.ownerH2 = refundAddr.h2X;
        note.nonce = nonce;
        note.asset = uint256(uint160(asset));
        note.id = id;
        note.value = value;

        insertNote(note);

        uint256 _nonce = nonce;
        nonce++;

        emit Refund(
            refundAddr,
            _nonce,
            asset,
            id,
            value,
            _totalCount() - 1
        );
    }

    function _hashSpend(IWallet.SpendTransaction calldata spend)
        private
        pure
        returns (bytes32)
    {
        bytes memory payload = abi.encodePacked(
            spend.commitmentTreeRoot,
            spend.nullifier,
            spend.newNoteCommitment,
            spend.valueToSpend,
            spend.asset,
            spend.id
        );

        return keccak256(payload);
    }

    function commitSubtree(
        uint256 newRoot,
        uint256[8] calldata proof
    ) external {
        // append 0s if the queue is empty or the batch isn't full
        if (queue.isEmpty()) {
            uint256 numEmptyleaves = uint256(BATCH_SIZE) - uint256(batchLen);
            uint256[] memory emptyLeaves = new uint256[](numEmptyleaves);

            for (uint256 i = batchLen; i < BATCH_SIZE; i++) {
                batch[i] = ZERO;
                emptyLeaves[i - batchLen] = ZERO;
            } 
            batchLen = uint128(BATCH_SIZE);

            emit InsertNoteCommitments(emptyLeaves);
            accumulate();
        }

        uint256 accumulatorHash = queue.peek();
        (uint256 hi, uint256 lo) = FieldUtils.uint256ToFieldElemLimbs(accumulatorHash);

        // count is r + s bits
        // get bottom `r` bits of the path
        uint256 encodedPathAndHash = uint256(count) >> LOG2_BATCH_SIZE;
        // pack the top 3 bits of accumulatorhash to get r + 3 bits
        encodedPathAndHash |= hi << (LOG2_DEPTH - LOG2_BATCH_SIZE);

        require(
            subtreeUpdateVerifier.verifyProof(
                [proof[0], proof[1]],
                [
                    [proof[2], proof[3]],
                    [proof[4], proof[5]]
                ],
                [proof[6], proof[7]],
                [
                    root,
                    newRoot,
                    encodedPathAndHash,
                    lo
                ]
            ),
            "subtree update proof invalid"
        );
        
        queue.dequeue(); 
        root = newRoot;
        pastRoots[newRoot] = true;
        count += uint128(BATCH_SIZE);
    }
}
