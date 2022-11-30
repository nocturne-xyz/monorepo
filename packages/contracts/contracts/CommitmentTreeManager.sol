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
        uint256 indexed nullifierA,
        uint256 indexed nullifierB,
        IWallet.NocturneAddress ownerAddrA,
        uint256 newNoteCommitmentA,
        uint128 merkleIndexA,
        uint256 encappedKeyA,
        uint256 encryptedNoteA,
        IWallet.NocturneAddress ownerAddrB,
        uint256 newNoteCommitmentB,
        uint128 merkleIndexB,
        uint256 encappedKeyB,
        uint256 encryptedNoteB,
    );

    event InsertNoteCommitments(uint256[] commitments);

    event InsertNotes(IWallet.Note[] notes);

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

        bytes32 spendHash = _hashJoinSplit(joinSplitTx);
        uint256 operationDigest = uint256(
            keccak256(abi.encodePacked(operationHash, spendHash))
        ) % Utils.SNARK_SCALAR_FIELD;

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
                    joinSplitTx.newNoteACommitment,
                    joinSplitTx.commitmentTreeRoot,
                    uint256(uint160(joinSplitTx.asset)),
                    joinSplitTx.id,
                    joinSplitTx.publicSpend,
                    joinSplitTx.nullifierA,
                    joinSplitTx.nullifierB,
                    operationDigest
                ]
            ),
            "JoinSplit proof invalid"
        );

        uint256[] memory noteCommitments = new uint256[](2);
        noteCommitments[0] = joinSplitTx.newNoteACommitment;
        noteCommitments[1] = joinSplitTx.newNoteBCommitment;
        insertNoteCommitments(noteCommitments);

        nullifierSet[joinSplitTx.nullifierA] = true;
        nullifierSet[joinSplitTx.nullifierB] = true;

        emit Nullify(joinSplitTx.nullifierA);
        emit Nullify(joinSplitTx.nullifierB);
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
        merkle.applySubtreeUpdate(newRoot, proof);
        pastRoots[newRoot] = true;
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

    function _hashJoinSplit(
        IWallet.JoinSplitTransaction calldata joinSplit
    ) private pure returns (bytes32) {
        bytes memory payload = abi.encodePacked(
            joinSplit.commitmentTreeRoot,
            joinSplit.nullifierA,
            joinSplit.nullifierB,
            joinSplit.newNoteACommitment,
            joinSplit.newNoteBCommitment,
            joinSplit.publicSpend,
            joinSplit.asset,
            joinSplit.id
        );

        return keccak256(payload);
    }
}
