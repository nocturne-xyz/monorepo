// SPDX-License-Identifier: MIT
pragma solidity ^0.8.5;

import "./interfaces/IWallet.sol";
import "./interfaces/ISpend2Verifier.sol";
import "./interfaces/ISubtreeUpdateVerifier.sol";

import {IOffchainMerkleTree} from "./interfaces/IOffchainMerkleTree.sol";
import {FieldUtils} from "./libs/FieldUtils.sol";

contract CommitmentTreeManager {
    uint256 public constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    IOffchainMerkleTree public noteCommitmentTree;
    mapping(uint256 => bool) public pastRoots;
    mapping(uint256 => bool) public nullifierSet;
    uint256 public nonce;

    ISpend2Verifier public verifier;
    ISubtreeUpdateVerifier public subtreeUpdateVerifier;

    event Refund(
        IWallet.FLAXAddress refundAddr,
        uint256 indexed nonce,
        address indexed asset,
        uint256 indexed id,
        uint256 value,
        uint256 merkleIndex
    );

    event Spend(
        uint256 indexed oldNoteNullifier,
        uint256 indexed valueSpent,
        uint256 indexed merkleIndex
    );

    constructor(
        address _verifier,
        address _noteCommitmentTree
    ) {
        verifier = ISpend2Verifier(_verifier);
        noteCommitmentTree = IOffchainMerkleTree(_noteCommitmentTree);
    }

    function getCurrentRoot() external view returns (uint256) {
        return noteCommitmentTree.getRoot();
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

        emit Spend(
            spendTx.nullifier,
            spendTx.valueToSpend,
            noteCommitmentTree.totalCount() - 1
        );
    }

    function _handleRefund(
        IWallet.FLAXAddress memory refundAddr,
        address asset,
        uint256 id,
        uint256 value
    ) internal {
        uint256[] memory elems = new uint256[](6);
        elems[0] = refundAddr.h1X;
        elems[1] = refundAddr.h2X;
        elems[2] = nonce;
        elems[3] = uint256(uint160(asset));
        elems[4] = id;
        elems[5] = value;
        uint256 accumulator = FieldUtils.sha256FieldElemsToUint256(elems);

        uint256 _nonce = nonce;
        nonce++;

        noteCommitmentTree.insertLeafToQueue(accumulator);

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
