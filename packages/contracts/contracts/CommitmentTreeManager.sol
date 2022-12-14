// SPDX-License-Identifier: MIT
pragma solidity ^0.8.5;

import "./interfaces/IJoinSplitVerifier.sol";
import {IWallet} from "./interfaces/IWallet.sol";
import {IJoinSplitVerifier} from "./interfaces/IJoinSplitVerifier.sol";
import {Groth16} from "./libs/Groth16.sol";
import {OffchainMerkleTree, OffchainMerkleTreeData} from "./libs/OffchainMerkleTree.sol";
import {QueueLib} from "./libs/Queue.sol";
import {Utils} from "./libs/Utils.sol";
import {TreeUtils} from "./libs/TreeUtils.sol";

contract CommitmentTreeManager {
    using OffchainMerkleTree for OffchainMerkleTreeData;

    // past roots of the merkle tree
    mapping(uint256 => bool) public _pastRoots;

    mapping(uint256 => bool) public _nullifierSet;
    uint256 public _nonce;

    OffchainMerkleTreeData internal _merkle;
    IJoinSplitVerifier public _joinSplitVerifier;

    event Refund(
        IWallet.NocturneAddress refundAddr,
        uint256 indexed nonce,
        address indexed asset,
        uint256 indexed id,
        uint256 value,
        uint128 merkleIndex
    );

    event JoinSplit(
        uint256 indexed oldNoteANullifier,
        uint256 indexed oldNoteBNullifier,
        uint128 newNoteAIndex,
        uint128 newNoteBIndex,
        IWallet.JoinSplitTransaction joinSplitTx
    );

    event InsertNoteCommitments(uint256[] commitments);

    event InsertNotes(IWallet.Note[] notes);

    event SubtreeUpdate(uint256 newRoot, uint256 subtreeIndex);

    constructor(address joinSplitVerifier, address subtreeUpdateVerifier) {
        _merkle.initialize(subtreeUpdateVerifier);
        _joinSplitVerifier = IJoinSplitVerifier(joinSplitVerifier);
        _pastRoots[TreeUtils.EMPTY_TREE_ROOT] = true;
    }

    // Process a joinsplit transaction, assuming that the encoded proof is valid
    function _handleJoinSplit(
        IWallet.JoinSplitTransaction calldata joinSplitTx
    ) internal {
        // Check validity of nullifiers
        require(
            _pastRoots[joinSplitTx.commitmentTreeRoot],
            "Tree root not past root"
        );
        require(
            !_nullifierSet[joinSplitTx.nullifierA],
            "Nullifier A already used"
        );
        require(
            !_nullifierSet[joinSplitTx.nullifierB],
            "Nullifier B already used"
        );
        require(
            joinSplitTx.nullifierA != joinSplitTx.nullifierB,
            "2 nfs should !equal."
        );

        // Compute newNote indices in the merkle tree
        uint128 newNoteIndexA = _merkle.getTotalCount();
        uint128 newNoteIndexB = newNoteIndexA + 1;

        uint256[] memory noteCommitments = new uint256[](2);
        noteCommitments[0] = joinSplitTx.newNoteACommitment;
        noteCommitments[1] = joinSplitTx.newNoteBCommitment;
        insertNoteCommitments(noteCommitments);

        _nullifierSet[joinSplitTx.nullifierA] = true;
        _nullifierSet[joinSplitTx.nullifierB] = true;

        emit JoinSplit(
            joinSplitTx.nullifierA,
            joinSplitTx.nullifierB,
            newNoteIndexA,
            newNoteIndexB,
            joinSplitTx
        );
    }

    function root() public view returns (uint256) {
        return _merkle.getRoot();
    }

    function count() public view returns (uint256) {
        return _merkle.getCount();
    }

    function totalCount() public view returns (uint256) {
        return _merkle.getTotalCount();
    }

    function insertNoteCommitment(uint256 nc) internal {
        uint256[] memory ncs = new uint256[](1);
        ncs[0] = nc;
        insertNoteCommitments(ncs);
    }

    function insertNoteCommitments(uint256[] memory ncs) internal {
        _merkle.insertNoteCommitments(ncs);
        emit InsertNoteCommitments(ncs);
    }

    function insertNote(IWallet.Note memory note) internal {
        IWallet.Note[] memory notes = new IWallet.Note[](1);
        notes[0] = note;
        insertNotes(notes);
    }

    function insertNotes(IWallet.Note[] memory notes) internal {
        _merkle.insertNotes(notes);
        emit InsertNotes(notes);
    }

    function fillBatchWithZeros() external {
        uint256 numToInsert = TreeUtils.BATCH_SIZE - _merkle.batchLen;
        uint256[] memory zeros = new uint256[](numToInsert);
        insertNoteCommitments(zeros);
    }

    function applySubtreeUpdate(
        uint256 newRoot,
        uint256[8] calldata proof
    ) external {
        require(!_pastRoots[newRoot], "newRoot already a past root");

        uint256 subtreeIndex = _merkle.getCount();
        _merkle.applySubtreeUpdate(newRoot, proof);
        _pastRoots[newRoot] = true;

        emit SubtreeUpdate(newRoot, subtreeIndex);
    }

    function _handleRefund(
        IWallet.NocturneAddress memory refundAddr,
        address asset,
        uint256 id,
        uint256 value
    ) internal {
        IWallet.Note memory note;
        note.ownerH1 = refundAddr.h1X;
        note.ownerH2 = refundAddr.h2X;
        note.nonce = _nonce;
        note.asset = uint256(uint160(asset));
        note.id = id;
        note.value = value;

        insertNote(note);

        uint256 nonce = _nonce;
        _nonce++;

        emit Refund(
            refundAddr,
            nonce,
            asset,
            id,
            value,
            _merkle.getTotalCount() - 1
        );
    }
}
