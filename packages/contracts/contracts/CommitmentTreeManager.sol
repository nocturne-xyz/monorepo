// SPDX-License-Identifier: MIT
pragma solidity ^0.8.5;

import "./interfaces/ISpend2Verifier.sol";
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
    ISpend2Verifier public spend2Verifier;

    event Refund(
        IWallet.FLAXAddress refundAddr,
        uint256 indexed nonce,
        address indexed asset,
        uint256 indexed id,
        uint256 value,
        uint128 merkleIndex
    );

    event Spend(
        uint256 indexed oldNoteNullifier,
        uint256 indexed valueSpent,
        uint128 indexed merkleIndex
    );

    event InsertNoteCommitments(uint256[] commitments);

    event InsertNotes(IWallet.Note[] notes);

    constructor(address _spend2verifier, address _subtreeUpdateVerifier) {
        merkle.initialize(_subtreeUpdateVerifier);
        spend2Verifier = ISpend2Verifier(_spend2verifier);
        pastRoots[TreeUtils.EMPTY_TREE_ROOT] = true;
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
        ) % Utils.SNARK_SCALAR_FIELD;

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

        insertNoteCommitment(spendTx.newNoteCommitment);

        nullifierSet[spendTx.nullifier] = true;

        emit Spend(
            spendTx.nullifier,
            spendTx.valueToSpend,
            merkle.getTotalCount() - 1
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

    function applySubtreeUpdate(uint256 newRoot, uint256[8] calldata proof)
        external
    {
        merkle.applySubtreeUpdate(newRoot, proof);
        pastRoots[newRoot] = true;
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
            merkle.getTotalCount() - 1
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
}
