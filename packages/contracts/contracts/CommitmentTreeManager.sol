// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "./interfaces/IWallet.sol";
import "./interfaces/ISpend2Verifier.sol";

import {IBatchMerkle} from "./interfaces/IBatchMerkle.sol";
import {IHasherT6} from "./interfaces/IHasher.sol";

contract CommitmentTreeManager {
    uint256 public constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    IBatchMerkle public noteCommitmentTree;
    mapping(uint256 => bool) public pastRoots;
    mapping(uint256 => bool) public nullifierSet;
    uint256 public nonce;

    ISpend2Verifier public verifier;
    IHasherT6 public hasherT6;

    event Refund(
        IWallet.FLAXAddress indexed refundAddr,
        uint256 indexed nonce,
        address indexed asset,
        uint256 id,
        uint256 value,
        uint256 merkleIndex
    );

    event NewNoteFromSpend(
        uint256 indexed oldNoteNullifier,
        uint256 indexed oldNewValueDifference,
        uint256 indexed merkleIndex
    );

    constructor(
        address _verifier,
        address _noteCommitmentTree,
        address _hasherT6
    ) {
        verifier = ISpend2Verifier(_verifier);
        noteCommitmentTree = IBatchMerkle(_noteCommitmentTree);
        hasherT6 = IHasherT6(_hasherT6);
    }

    function commit2FromQueue() external {
        noteCommitmentTree.commit2FromQueue();
        pastRoots[noteCommitmentTree.root()] = true;
    }

    function commit8FromQueue() external {
        noteCommitmentTree.commit8FromQueue();
        pastRoots[noteCommitmentTree.root()] = true;
    }

    function getRoot() external view returns (uint256) {
        return noteCommitmentTree.root();
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
        ) % SNARK_SCALAR_FIELD;

        require(
            verifier.verifyProof(
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

        noteCommitmentTree.insertLeafToQueue(spendTx.newNoteCommitment);
        nullifierSet[spendTx.nullifier] = true;

        emit NewNoteFromSpend(
            spendTx.nullifier,
            spendTx.valueToSpend,
            noteCommitmentTree.tentativeCount() - 1
        );
    }

    function _handleRefund(
        IWallet.FLAXAddress memory refundAddr,
        uint256 refundAddrHash,
        address asset,
        uint256 id,
        uint256 value
    ) internal {
        uint256 noteCommitment = hasherT6.hash(
            [refundAddrHash, nonce, uint256(uint160(asset)), id, value]
        );

        uint256 _nonce = nonce;
        nonce++;

        noteCommitmentTree.insertLeafToQueue(noteCommitment);

        emit Refund(
            refundAddr,
            _nonce,
            asset,
            id,
            value,
            noteCommitmentTree.totalCount() - 1
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
