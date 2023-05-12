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
    mapping(address => bool) public _subtreeBatchFiller;

    // Gap for upgrade safety
    uint256[50] private __GAP;

    /// @notice Event emitted when a subtree batch filler is given/revoked permission
    event SubtreeBatchFillerPermissionSet(address filler, bool permission);

    /// @notice Event emitted when a refund is processed
    /// @dev Refund means any outstanding assets left in the handler during execution
    ///      or a new deposit
    event RefundProcessed(
        StealthAddress refundAddr,
        uint256 nonce,
        uint256 encodedAssetAddr,
        uint256 encodedAssetId,
        uint256 value,
        uint128 merkleIndex
    );

    /// @notice Event emitted when a joinsplit is processed
    event JoinSplitProcessed(
        uint256 indexed oldNoteANullifier,
        uint256 indexed oldNoteBNullifier,
        uint128 newNoteAIndex,
        uint128 newNoteBIndex,
        JoinSplit joinSplit
    );

    /// @notice Event emitted when a new note is inserted into the tree
    event InsertNote(EncodedNote note);

    /// @notice Event emitted when a new batch of note commitments is inserted
    event InsertNoteCommitments(uint256[] commitments);

    /// @notice Event emitted when a subtree (and subsequently the main tree's root) are updated
    event SubtreeUpdate(uint256 newRoot, uint256 subtreeIndex);

    /// @notice Internal initialization function
    function __CommitmentTreeManager_init(
        address subtreeUpdateVerifier
    ) internal onlyInitializing {
        __Ownable_init();
        __Pausable_init();
        _merkle.initialize(subtreeUpdateVerifier);
        _pastRoots[TreeUtils.EMPTY_TREE_ROOT] = true;
    }

    modifier onlySubtreeBatchFiller() {
        require(_subtreeBatchFiller[msg.sender], "Only subtree batch filler");
        _;
    }

    /// @notice Owner-only function, sets address permission to call `fillBatchesWithZeros`
    function setSubtreeBatchFillerPermission(
        address filler,
        bool permission
    ) external onlyOwner {
        _subtreeBatchFiller[filler] = permission;
        emit SubtreeBatchFillerPermissionSet(filler, permission);
    }

    /// @notice Inserts a batch of zero refund notes into the commitment tree
    /// @dev This function allows the an entity to expedite process of being able to update
    ///      the merkle tree root. The caller of this function
    function fillBatchWithZeros() external onlySubtreeBatchFiller {
        require(_merkle.batchLen > 0, "!zero fill empty batch");

        uint256 numToInsert = TreeUtils.BATCH_SIZE - _merkle.batchLen;
        uint256[] memory zeros = new uint256[](numToInsert);
        _insertNoteCommitments(zeros);
    }

    function _insertNote(EncodedNote memory note) internal {
        _merkle.insertNote(note);
        emit InsertNote(note);
    }

    function _insertNoteCommitments(uint256[] memory ncs) internal {
        _merkle.insertNoteCommitments(ncs);
        emit InsertNoteCommitments(ncs);
    }

    /// @notice Attempts to update the tree's root given a subtree update proof
    /// @param newRoot The new root of the Merkle tree after the subtree update
    /// @param proof The proof for the subtree update
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

    /// @notice Returns the root of the merkle tree
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

    /// @notice Process a joinsplit transaction, assuming that the encoded proof is valid
    /// @dev This function should be re-entry safe. Nullifiers are be marked
    ///      used as soon as they are checked to be valid.
    /// @param joinSplit Joinsplit to process
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

        // Insert new note commitments
        uint256[] memory noteCommitments = new uint256[](2);
        noteCommitments[0] = joinSplit.newNoteACommitment;
        noteCommitments[1] = joinSplit.newNoteBCommitment;
        _insertNoteCommitments(noteCommitments);

        emit JoinSplitProcessed(
            joinSplit.nullifierA,
            joinSplit.nullifierB,
            newNoteIndexA,
            newNoteIndexB,
            joinSplit
        );
    }

    /// @notice Inserts a single refund note into the commitment tree
    /// @param encodedAsset Encoded asset refund note is being created for
    /// @param refundAddr Stealth address refund note is created to
    /// @param value Value of refund note for given asset
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
