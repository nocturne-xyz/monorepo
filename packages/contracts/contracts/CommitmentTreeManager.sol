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
        uint256 _numToInsert = TreeUtils.BATCH_SIZE - merkle.batchLen;
        uint256[] memory _zeros = new uint256[](_numToInsert);
        _insertNoteCommitments(_zeros);
    }

    function applySubtreeUpdate(
        uint256 _newRoot,
        uint256[8] calldata _proof
    ) external {
        merkle.applySubtreeUpdate(_newRoot, _proof);
        pastRoots[_newRoot] = true;
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
        IWallet.JoinSplitTransaction calldata _joinSplitTx,
        uint256 _operationDigest
    ) internal {
        require(
            pastRoots[_joinSplitTx.commitmentTreeRoot],
            "Given tree root not a past root"
        );
        require(
            !nullifierSet[_joinSplitTx.nullifierA],
            "Nullifier A already used"
        );
        require(
            !nullifierSet[_joinSplitTx.nullifierB],
            "Nullifier B already used"
        );

        require(
            joinSplitVerifier.verifyProof(
                [_joinSplitTx.proof[0], _joinSplitTx.proof[1]],
                [
                    [_joinSplitTx.proof[2], _joinSplitTx.proof[3]],
                    [_joinSplitTx.proof[4], _joinSplitTx.proof[5]]
                ],
                [_joinSplitTx.proof[6], _joinSplitTx.proof[7]],
                [
                    _joinSplitTx.newNoteACommitment,
                    _joinSplitTx.newNoteBCommitment,
                    _joinSplitTx.commitmentTreeRoot,
                    _joinSplitTx.publicSpend,
                    _joinSplitTx.nullifierA,
                    _joinSplitTx.nullifierB,
                    _operationDigest,
                    uint256(uint160(_joinSplitTx.asset)),
                    _joinSplitTx.id
                ]
            ),
            "JoinSplit proof invalid"
        );

        // Compute newNote indices in the merkle tree
        uint128 _newNoteIndexA = merkle.getTotalCount();
        uint128 _newNoteIndexB = _newNoteIndexA + 1;

        uint256[] memory _noteCommitments = new uint256[](2);
        _noteCommitments[0] = _joinSplitTx.newNoteACommitment;
        _noteCommitments[1] = _joinSplitTx.newNoteBCommitment;
        _insertNoteCommitments(_noteCommitments);

        nullifierSet[_joinSplitTx.nullifierA] = true;
        nullifierSet[_joinSplitTx.nullifierB] = true;

        emit JoinSplit(
            _joinSplitTx.nullifierA,
            _joinSplitTx.nullifierB,
            _newNoteIndexA,
            _newNoteIndexB,
            _joinSplitTx
        );
    }

    function _insertNoteCommitment(uint256 _nc) internal {
        uint256[] memory _ncs = new uint256[](1);
        _ncs[0] = _nc;
        _insertNoteCommitments(_ncs);
    }

    function _insertNoteCommitments(uint256[] memory _ncs) internal {
        merkle.insertNoteCommitments(_ncs);
        emit InsertNoteCommitments(_ncs);
    }

    function _insertNote(IWallet.Note memory _note) internal {
        IWallet.Note[] memory _notes = new IWallet.Note[](1);
        _notes[0] = _note;
        _insertNotes(_notes);
    }

    function _insertNotes(IWallet.Note[] memory _notes) internal {
        merkle.insertNotes(_notes);
        emit InsertNotes(_notes);
    }

    function _handleRefund(
        IWallet.NocturneAddress memory _refundAddr,
        address _asset,
        uint256 _id,
        uint256 _value
    ) internal {
        IWallet.Note memory _note;
        _note.ownerH1 = _refundAddr.h1X;
        _note.ownerH2 = _refundAddr.h2X;
        _note.nonce = nonce;
        _note.asset = uint256(uint160(_asset));
        _note.id = _id;
        _note.value = _value;

        _insertNote(_note);

        uint256 _nonce = nonce;
        nonce++;

        emit Refund(
            _refundAddr,
            _nonce,
            _asset,
            _id,
            _value,
            merkle.getTotalCount() - 1
        );
    }
}
