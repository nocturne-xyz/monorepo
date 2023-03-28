// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
// External
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
// Internal
import {OffchainMerkleTree, OffchainMerkleTreeData} from "./libs/OffchainMerkleTree.sol";
import {Utils} from "./libs/Utils.sol";
import {TreeUtils} from "./libs/TreeUtils.sol";
import "./libs/Types.sol";

contract CommitmentTreeManager is Initializable, PausableUpgradeable {
    using OffchainMerkleTree for OffchainMerkleTreeData;

    // past roots of the merkle tree
    mapping(uint256 => bool) public _pastRoots;

    mapping(uint256 => bool) public _nullifierSet;

    OffchainMerkleTreeData internal _merkle;

    // gap for upgrade safety
    uint256[50] private __GAP;

    event RefundProcessed(
        StealthAddress refundAddr,
        uint256 nonce,
        uint256 encodedAssetAddr,
        uint256 encodedAssetId,
        uint256 value,
        uint128 merkleIndex
    );

    event JoinSplitProcessed(
        uint256 indexed oldNoteANullifier,
        uint256 indexed oldNoteBNullifier,
        uint128 newNoteAIndex,
        uint128 newNoteBIndex,
        JoinSplit joinSplit
    );

    event InsertNoteCommitments(uint256[] commitments);

    event InsertNotes(EncodedNote[] notes);

    event SubtreeUpdate(uint256 newRoot, uint256 subtreeIndex);

    function __CommitmentTreeManager_init(
        address subtreeUpdateVerifier
    ) internal onlyInitializing {
        __Pausable_init();
        _merkle.initialize(subtreeUpdateVerifier);
        _pastRoots[TreeUtils.EMPTY_TREE_ROOT] = true;
    }

    /**
      Process a joinsplit transaction, assuming that the encoded proof is valid

      @dev This function should be re-entry safe. Nullifiers must be marked
      used as soon as they are checked to be valid.
    */
    function _handleJoinSplit(JoinSplit calldata joinSplit) internal {
        // Check validity of both nullifiers
        require(
            _pastRoots[joinSplit.commitmentTreeRoot],
            "Tree root not past root"
        );
        require(
            !_nullifierSet[joinSplit.nullifierA],
            "Nullifier A already used"
        );
        require(
            !_nullifierSet[joinSplit.nullifierB],
            "Nullifier B already used"
        );
        require(
            joinSplit.nullifierA != joinSplit.nullifierB,
            "2 nfs should !equal"
        );

        // Mark nullifiers as used
        _nullifierSet[joinSplit.nullifierA] = true;
        _nullifierSet[joinSplit.nullifierB] = true;

        // Compute newNote indices in the merkle tree
        uint128 newNoteIndexA = _merkle.getTotalCount();
        uint128 newNoteIndexB = newNoteIndexA + 1;

        uint256[] memory noteCommitments = new uint256[](2);
        noteCommitments[0] = joinSplit.newNoteACommitment;
        noteCommitments[1] = joinSplit.newNoteBCommitment;
        insertNoteCommitments(noteCommitments);

        emit JoinSplitProcessed(
            joinSplit.nullifierA,
            joinSplit.nullifierB,
            newNoteIndexA,
            newNoteIndexB,
            joinSplit
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

    function _fillBatchWithZeros() internal {
        uint256 numToInsert = TreeUtils.BATCH_SIZE - _merkle.batchLen;
        uint256[] memory zeros = new uint256[](numToInsert);
        insertNoteCommitments(zeros);
    }

    function applySubtreeUpdate(
        uint256 newRoot,
        uint256[8] calldata proof
    ) external whenNotPaused {
        require(!_pastRoots[newRoot], "newRoot already a past root");

        uint256 subtreeIndex = _merkle.getCount();
        _merkle.applySubtreeUpdate(newRoot, proof);
        _pastRoots[newRoot] = true;

        emit SubtreeUpdate(newRoot, subtreeIndex);
    }

    function _handleRefundNote(
        EncodedAsset memory encodedAsset,
        StealthAddress calldata refundAddr,
        uint256 value
    ) internal {
        uint128 index = _merkle.getTotalCount();
        EncodedNote memory note = EncodedNote({
            ownerH1: refundAddr.h1X,
            ownerH2: refundAddr.h2X,
            nonce: index,
            encodedAssetAddr: encodedAsset.encodedAssetAddr,
            encodedAssetId: encodedAsset.encodedAssetId,
            value: value
        });

        insertNote(note);

        emit RefundProcessed(
            refundAddr,
            index,
            encodedAsset.encodedAssetAddr,
            encodedAsset.encodedAssetId,
            value,
            index
        );
    }
}
