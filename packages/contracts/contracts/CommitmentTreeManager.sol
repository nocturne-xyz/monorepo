// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IWallet} from "./interfaces/IWallet.sol";
import {IJoinSplitVerifier} from "./interfaces/IJoinSplitVerifier.sol";
import {Groth16} from "./libs/Groth16.sol";
import {OffchainMerkleTree, OffchainMerkleTreeData} from "./libs/OffchainMerkleTree.sol";
import {QueueLib} from "./libs/Queue.sol";
import {Utils} from "./libs/Utils.sol";
import {TreeUtils} from "./libs/TreeUtils.sol";

import "./libs/types.sol";

contract CommitmentTreeManager {
    using OffchainMerkleTree for OffchainMerkleTreeData;

    // past roots of the merkle tree
    mapping(uint256 => bool) public _pastRoots;

    mapping(uint256 => bool) public _nullifierSet;

    OffchainMerkleTreeData internal _merkle;
    IJoinSplitVerifier public immutable _joinSplitVerifier;

    event Refund(
        NocturneAddress refundAddr,
        uint256 nonce,
        uint256 encodedAssetAddr,
        uint256 encodedAssetId,
        uint256 value,
        uint128 merkleIndex
    );

    event JoinSplit(
        uint256 indexed oldNoteANullifier,
        uint256 indexed oldNoteBNullifier,
        uint128 newNoteAIndex,
        uint128 newNoteBIndex,
        JoinSplitTransaction joinSplitTx
    );

    event InsertNoteCommitments(uint256[] commitments);

    event InsertNotes(EncodedNote[] notes);

    event SubtreeUpdate(uint256 newRoot, uint256 subtreeIndex);

    constructor(address joinSplitVerifier, address subtreeUpdateVerifier) {
        _merkle.initialize(subtreeUpdateVerifier);
        _joinSplitVerifier = IJoinSplitVerifier(joinSplitVerifier);
        _pastRoots[TreeUtils.EMPTY_TREE_ROOT] = true;
    }

    /**
      Process a joinsplit transaction, assuming that the encoded proof is valid

      @dev This function should be re-entry safe. Nullifiers must be marked
      used as soon as they are checked to be valid.
    */
    function _handleJoinSplit(
        JoinSplitTransaction calldata joinSplitTx
    ) internal {
        // Check validity of both nullifiers
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

        // Mark nullifiers as used
        _nullifierSet[joinSplitTx.nullifierA] = true;
        _nullifierSet[joinSplitTx.nullifierB] = true;

        // Compute newNote indices in the merkle tree
        uint128 newNoteIndexA = _merkle.getTotalCount();
        uint128 newNoteIndexB = newNoteIndexA + 1;

        uint256[] memory noteCommitments = new uint256[](2);
        noteCommitments[0] = joinSplitTx.newNoteACommitment;
        noteCommitments[1] = joinSplitTx.newNoteBCommitment;
        insertNoteCommitments(noteCommitments);

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

    function insertNote(EncodedNote memory note) internal {
        EncodedNote[] memory notes = new EncodedNote[](1);
        notes[0] = note;
        insertNotes(notes);
    }

    function insertNotes(EncodedNote[] memory notes) internal {
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

    function _handleRefundNote(
        NocturneAddress memory refundAddr,
        uint256 encodedAssetAddr,
        uint256 encodedAssetId,
        uint256 value
    ) internal {
        uint128 index = _merkle.getTotalCount();
        EncodedNote memory note = EncodedNote({
            ownerH1: refundAddr.h1X,
            ownerH2: refundAddr.h2X,
            nonce: index,
            encodedAssetAddr: encodedAssetAddr,
            encodedAssetId: encodedAssetId,
            value: value
        });

        insertNote(note);

        emit Refund(
            refundAddr,
            index,
            encodedAssetAddr,
            encodedAssetId,
            value,
            index
        );
    }
}
