// SPDX-License-Identifier: MIT
pragma solidity ^0.8.5;

import "./interfaces/IJoinSplitVerifier.sol";
import {IWallet} from "./interfaces/IWallet.sol";
import {OffchainMerkleTree, OffchainMerkleTreeData} from "./libs/OffchainMerkleTree.sol";
import {QueueLib} from "./libs/Queue.sol";
import {Utils} from "./libs/Utils.sol";
import {TreeUtils} from "./libs/TreeUtils.sol";

contract CommitmentTreeManager {
    using OffchainMerkleTree for OffchainMerkleTreeData;

    // past roots of the merkle tree
    mapping(uint256 => bool) public pastRoots;

    mapping(uint256 => bool) public nullifierSet;
    uint256 public nonce;

    OffchainMerkleTreeData internal merkle;
    IJoinSplitVerifier public joinSplitVerifier;

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

    constructor(address _joinSplitVerifier, address _subtreeUpdateVerifier) {
        merkle.initialize(_subtreeUpdateVerifier);
        joinSplitVerifier = IJoinSplitVerifier(_joinSplitVerifier);
        pastRoots[TreeUtils.EMPTY_TREE_ROOT] = true;
    }

    function fillBatchWithZeros() external {
        uint256 numToInsert = TreeUtils.BATCH_SIZE - merkle.batchLen;
        uint256[] memory zeros = new uint256[](numToInsert);
        _insertNoteCommitments(zeros);
    }

    function applySubtreeUpdate(
        uint256 newRoot,
        uint256[8] calldata proof
    ) external {
        merkle.applySubtreeUpdate(newRoot, proof);
        pastRoots[newRoot] = true;
    }

    function root() public view returns (uint256) {
        return merkle.getRoot();
    }

    function count() public view returns (uint256) {
        return merkle.getCount();
    }

    function totalCount() public view returns (uint256) {
        return merkle.getTotalCount();
    }

    function _handleJoinSplit(
        IWallet.JoinSplitTransaction calldata joinSplitTx,
        uint256 operationDigest
    ) internal {
        require(
            pastRoots[joinSplitTx.commitmentTreeRoot],
            "Given tree root not a past root"
        );
        require(
            !nullifierSet[joinSplitTx.nullifierA],
            "Nullifier A already used"
        );
        require(
            !nullifierSet[joinSplitTx.nullifierB],
            "Nullifier B already used"
        );

        require(
            joinSplitVerifier.verifyProof(
                [joinSplitTx.proof[0], joinSplitTx.proof[1]],
                [
                    [joinSplitTx.proof[2], joinSplitTx.proof[3]],
                    [joinSplitTx.proof[4], joinSplitTx.proof[5]]
                ],
                [joinSplitTx.proof[6], joinSplitTx.proof[7]],
                [
                    joinSplitTx.newNoteACommitment,
                    joinSplitTx.newNoteBCommitment,
                    joinSplitTx.commitmentTreeRoot,
                    joinSplitTx.publicSpend,
                    joinSplitTx.nullifierA,
                    joinSplitTx.nullifierB,
                    operationDigest,
                    uint256(uint160(joinSplitTx.asset)),
                    joinSplitTx.id
                ]
            ),
            "JoinSplit proof invalid"
        );

        // Compute newNote indices in the merkle tree
        uint128 newNoteIndexA = merkle.getTotalCount();
        uint128 newNoteIndexB = newNoteIndexA + 1;

        uint256[] memory noteCommitments = new uint256[](2);
        noteCommitments[0] = joinSplitTx.newNoteACommitment;
        noteCommitments[1] = joinSplitTx.newNoteBCommitment;
        _insertNoteCommitments(noteCommitments);

        nullifierSet[joinSplitTx.nullifierA] = true;
        nullifierSet[joinSplitTx.nullifierB] = true;

        emit JoinSplit(
            joinSplitTx.nullifierA,
            joinSplitTx.nullifierB,
            newNoteIndexA,
            newNoteIndexB,
            joinSplitTx
        );
    }

    function _insertNoteCommitment(uint256 nc) internal {
        uint256[] memory ncs = new uint256[](1);
        ncs[0] = nc;
        _insertNoteCommitments(ncs);
    }

    function _insertNoteCommitments(uint256[] memory ncs) internal {
        merkle.insertNoteCommitments(ncs);
        emit InsertNoteCommitments(ncs);
    }

    function _insertNote(IWallet.Note memory note) internal {
        IWallet.Note[] memory notes = new IWallet.Note[](1);
        notes[0] = note;
        _insertNotes(notes);
    }

    function _insertNotes(IWallet.Note[] memory notes) internal {
        merkle.insertNotes(notes);
        emit InsertNotes(notes);
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
        note.nonce = nonce;
        note.asset = uint256(uint160(asset));
        note.id = id;
        note.value = value;

        _insertNote(note);

        uint256 _nonce = nonce;
        nonce++;

        emit Refund(
            refundAddr,
            _nonce,
            asset,
            id,
            value,
            merkle.getTotalCount() - 1
        );
    }
}
