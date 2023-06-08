// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
// External
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
// Internal
import {LibOffchainMerkleTree, OffchainMerkleTree} from "./libs/OffchainMerkleTree.sol";
import {Utils} from "./libs/Utils.sol";
import {TreeUtils} from "./libs/TreeUtils.sol";
import "./libs/Types.sol";

/// @title CommitmentTreeManager
/// @author Nocturne Labs
/// @notice Manages the commitment tree, keeps track of past roots, and keeps track of used
///         nullifiers.
contract CommitmentTreeManager is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable
{
    using LibOffchainMerkleTree for OffchainMerkleTree;

    // Set of past roots of the merkle tree
    mapping(uint256 => bool) public _pastRoots;

    // Set of used nullifiers
    mapping(uint256 => bool) public _nullifierSet;

    // Offchain merkle tree struct
    OffchainMerkleTree internal _merkle;

    // Set of addressed allowed to fill subtree batches with zeros
    mapping(address => bool) public _subtreeBatchFillers;

    // Gap for upgrade safety
    uint256[50] private __GAP;

    /// @notice Event emitted when a subtree batch filler is given/revoked permission
    event SubtreeBatchFillerPermissionSet(address filler, bool permission);

    /// @notice Event emitted when a refund is processed
    /// @dev Refund means any outstanding assets left in the handler during execution
    ///      or a new deposit
    event RefundProcessed(
        CompressedStealthAddress refundAddr,
        uint256 nonce,
        uint256 encodedAssetAddr,
        uint256 encodedAssetId,
        uint256 value,
        uint128 indexed merkleIndex
    );

    /// @notice Event emitted when a joinsplit is processed
    event JoinSplitProcessed(
        uint256 oldNoteANullifier,
        uint256 oldNoteBNullifier,
        uint128 indexed newNoteAIndex,
        uint128 indexed newNoteBIndex,
        uint256 newNoteACommitment,
        uint256 newNoteBCommitment,
        uint256 encSenderCanonAddrC1,
        uint256 encSenderCanonAddrC2,
        EncodedAsset encodedAsset,
        uint256 publicSpend,
        EncryptedNote newNoteAEncrypted,
        EncryptedNote newNoteBEncrypted
    );

    /// @notice Event emitted when a subtree batch is filled with zeros
    event FilledBatchWithZeros(uint256 startIndex, uint256 numZeros);

    /// @notice Event emitted when a subtree (and subsequently the main tree's root) are updated
    event SubtreeUpdate(uint256 newRoot, uint256 subtreeBatchOffset);

    /// @notice Internal initialization function
    /// @param subtreeUpdateVerifier Address of the subtree update verifier contract
    function __CommitmentTreeManager_init(
        address subtreeUpdateVerifier
    ) internal onlyInitializing {
        __Ownable_init();
        __Pausable_init();
        _merkle.initialize(subtreeUpdateVerifier);
        _pastRoots[TreeUtils.EMPTY_TREE_ROOT] = true;
    }

    /// @notice Require caller is permissioned batch filler
    modifier onlySubtreeBatchFiller() {
        require(_subtreeBatchFillers[msg.sender], "Only subtree batch filler");
        _;
    }

    /// @notice Owner-only function, sets address permission to call `fillBatchesWithZeros`
    /// @param filler Address to set permission for
    /// @param permission Permission to set
    function setSubtreeBatchFillerPermission(
        address filler,
        bool permission
    ) external onlyOwner {
        _subtreeBatchFillers[filler] = permission;
        emit SubtreeBatchFillerPermissionSet(filler, permission);
    }

    /// @notice Inserts a batch of zero refund notes into the commitment tree
    /// @dev This function allows the an entity to expedite process of being able to update
    ///      the merkle tree root. The caller of this function
    function fillBatchWithZeros() external onlySubtreeBatchFiller {
        uint256 batchLen = _merkle.getBatchLen();
        require(batchLen > 0, "!zero fill empty batch");

        uint256 startIndex = _merkle.getTotalCount();
        uint256 numZeros = TreeUtils.BATCH_SIZE - batchLen;

        _merkle.fillBatchWithZeros();

        emit FilledBatchWithZeros(startIndex, numZeros);
    }

    /// @notice Attempts to update the tree's root given a subtree update proof
    /// @param newRoot The new root of the Merkle tree after the subtree update
    /// @param proof The proof for the subtree update
    function applySubtreeUpdate(
        uint256 newRoot,
        uint256[8] calldata proof
    ) external whenNotPaused {
        require(!_pastRoots[newRoot], "newRoot already a past root");

        uint256 subtreeBatchOffset = _merkle.getCount();
        _merkle.applySubtreeUpdate(newRoot, proof);
        _pastRoots[newRoot] = true;

        emit SubtreeUpdate(newRoot, subtreeBatchOffset);
    }

    /// @notice Returns current root of the merkle tree
    function root() public view returns (uint256) {
        return _merkle.getRoot();
    }

    /// @notice Returns count of the merkle tree under the current root
    function count() public view returns (uint256) {
        return _merkle.getCount();
    }

    /// @notice Returns the count of the merkle tree including leaves that have not yet been
    ///         included in a subtree update
    function totalCount() public view returns (uint256) {
        return _merkle.getTotalCount();
    }

    /// @notice Inserts note into commitment tree
    /// @param note note to insert
    function _insertNote(EncodedNote memory note) internal {
        _merkle.insertNote(note);
    }

    /// @notice Inserts several note commitments into the tree
    /// @param ncs Note commitments to insert
    function _insertNoteCommitments(uint256[] memory ncs) internal {
        _merkle.insertNoteCommitments(ncs);
    }

    /// @notice Process several joinsplits, assuming that their proofs have already been verified
    /// @dev This function should be re-entry safe. Nullifiers are be marked
    ///      used as soon as they are checked to be valid.
    /// @param joinSplits calldata array of Joinsplits to process
    function _handleJoinSplits(JoinSplit[] calldata joinSplits) internal {
        uint256 numJoinSplits = joinSplits.length;
        uint256[] memory newNoteCommitments = new uint256[](numJoinSplits * 2);
        uint128 offset = _merkle.getTotalCount();
        for (uint256 i = 0; i < numJoinSplits; i++) {
            JoinSplit calldata joinSplit = joinSplits[i];
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
            uint128 newNoteIndexA = offset + uint128(2 * i);
            uint128 newNoteIndexB = offset + uint128(2 * i + 1);

            // Insert new note commitments
            newNoteCommitments[i * 2] = joinSplit.newNoteACommitment;
            newNoteCommitments[i * 2 + 1] = joinSplit.newNoteBCommitment;

            emit JoinSplitProcessed(
                joinSplit.nullifierA,
                joinSplit.nullifierB,
                newNoteIndexA,
                newNoteIndexB,
                joinSplit.newNoteACommitment,
                joinSplit.newNoteBCommitment,
                joinSplit.encSenderCanonAddrC1,
                joinSplit.encSenderCanonAddrC2,
                joinSplit.encodedAsset,
                joinSplit.publicSpend,
                joinSplit.newNoteAEncrypted,
                joinSplit.newNoteBEncrypted
            );
        }

        _insertNoteCommitments(newNoteCommitments);
    }

    /// @notice Inserts a single refund note into the commitment tree
    /// @param encodedAsset Encoded asset refund note is being created for
    /// @param refundAddr Stealth address refund note is created to
    /// @param value Value of refund note for given asset
    function _handleRefundNote(
        EncodedAsset memory encodedAsset,
        CompressedStealthAddress calldata refundAddr,
        uint256 value
    ) internal {
        uint128 index = _merkle.getTotalCount();
        EncodedNote memory note = EncodedNote({
            ownerH1: refundAddr.h1,
            ownerH2: refundAddr.h2,
            nonce: index,
            encodedAssetAddr: encodedAsset.encodedAssetAddr,
            encodedAssetId: encodedAsset.encodedAssetId,
            value: value
        });

        _insertNote(note);

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
