// SPDX-License-Identifier: MIT
pragma solidity ^0.8.5;

import "./interfaces/ISpend2Verifier.sol";
import {IWallet} from "./interfaces/IWallet.sol";
import {IOffchainMerkleTree} from "./interfaces/IOffchainMerkleTree.sol";

import {QueueLib} from "./libs/Queue.sol";
import {Utils} from "./libs/Utils.sol";

contract CommitmentTreeManager {
    // past roots of the merkle tree
    mapping(uint256 => bool) public pastRoots;

    mapping(uint256 => bool) public nullifierSet;
    uint256 public nonce;

    ISpend2Verifier public spend2Verifier;
    IOffchainMerkleTree public merkle;

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

    constructor(address _spend2verifier, address _merkle) {
        merkle = IOffchainMerkleTree(_merkle);
        spend2Verifier = ISpend2Verifier(_spend2verifier);
        pastRoots[Utils.EMPTY_TREE_ROOT] = true;
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

        merkle.insertNoteCommitment(spendTx.newNoteCommitment);
        nullifierSet[spendTx.nullifier] = true;

        emit Spend(
            spendTx.nullifier,
            spendTx.valueToSpend,
            merkle.totalCount() - 1
        );
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

        merkle.insertNote(note);

        uint256 _nonce = nonce;
        nonce++;

        emit Refund(
            refundAddr,
            _nonce,
            asset,
            id,
            value,
            merkle.totalCount() - 1
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
