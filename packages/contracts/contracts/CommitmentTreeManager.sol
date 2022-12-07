// SPDX-License-Identifier: MIT
pragma solidity ^0.8.5;

import "./interfaces/IJoinSplitVerifier.sol";
import {IWallet} from "./interfaces/IWallet.sol";
import {IVerifier} from "./interfaces/IVerifier.sol";
import {Groth16} from "./libs/Groth16.sol";
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
    IVerifier public joinSplitVerifier;

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

    constructor(address _joinSplitVerifier, address _subtreeUpdateVerifier) {
        merkle.initialize(_subtreeUpdateVerifier);
        joinSplitVerifier = IJoinSplitVerifier(_joinSplitVerifier);
        pastRoots[TreeUtils.EMPTY_TREE_ROOT] = true;
    }

    function _handleJoinSplit(
        IWallet.JoinSplitTransaction calldata joinSplitTx,
        bytes32 operationHash
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

        uint256 operationDigest = uint256(operationHash) %
            Utils.SNARK_SCALAR_FIELD;

        Groth16.Proof memory proof = Utils.proof8ToStruct(joinSplitTx.proof);
        uint256[] memory pis = new uint256[](9);
        pis[0] = joinSplitTx.newNoteACommitment;
        pis[1] = joinSplitTx.newNoteBCommitment;
        pis[2] = joinSplitTx.commitmentTreeRoot;
        pis[3] = joinSplitTx.publicSpend;
        pis[4] = joinSplitTx.nullifierA;
        pis[5] = joinSplitTx.nullifierB;
        pis[6] = operationDigest;
        pis[7] = uint256(uint160(joinSplitTx.asset));
        pis[8] = joinSplitTx.id;
        require(
            joinSplitVerifier.verifyProof(proof, pis),
            "JoinSplit proof invalid"
        );

        // Compute newNote indices in the merkle tree
        uint128 newNoteIndexA = merkle.getTotalCount();
        uint128 newNoteIndexB = newNoteIndexA + 1;

        uint256[] memory noteCommitments = new uint256[](2);
        noteCommitments[0] = joinSplitTx.newNoteACommitment;
        noteCommitments[1] = joinSplitTx.newNoteBCommitment;
        insertNoteCommitments(noteCommitments);

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

    function root() public view returns (uint256) {
        return merkle.getRoot();
    }

    function count() public view returns (uint256) {
        return merkle.getCount();
    }

    function totalCount() public view returns (uint256) {
        return merkle.getTotalCount();
    }

    function insertNoteCommitment(uint256 nc) internal {
        uint256[] memory ncs = new uint256[](1);
        ncs[0] = nc;
        insertNoteCommitments(ncs);
    }

    function insertNoteCommitments(uint256[] memory ncs) internal {
        merkle.insertNoteCommitments(ncs);
        emit InsertNoteCommitments(ncs);
    }

    function insertNote(IWallet.Note memory note) internal {
        IWallet.Note[] memory notes = new IWallet.Note[](1);
        notes[0] = note;
        insertNotes(notes);
    }

    function insertNotes(IWallet.Note[] memory notes) internal {
        merkle.insertNotes(notes);
        emit InsertNotes(notes);
    }

    function fillBatchWithZeros() external {
        uint256 numToInsert = TreeUtils.BATCH_SIZE - merkle.batchLen;
        uint256[] memory zeros = new uint256[](numToInsert);
        insertNoteCommitments(zeros);
    }

    function applySubtreeUpdate(
        uint256 newRoot,
        uint256[8] calldata proof
    ) external {
        require(!pastRoots[newRoot], "newRoot already a past root");

        uint256 subtreeIndex = merkle.getCount();
        merkle.applySubtreeUpdate(newRoot, proof);
        pastRoots[newRoot] = true;

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
            merkle.getTotalCount() - 1
        );
    }
}
