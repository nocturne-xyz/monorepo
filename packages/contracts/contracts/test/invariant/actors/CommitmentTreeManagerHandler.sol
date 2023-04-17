// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "../../../CommitmentTreeManager.sol";
import "../../../libs/Types.sol";

contract CommitmentTreeManagerHandler is CommitmentTreeManager {
    constructor(address subtreeUpdateVerifier) {
        __CommitmentTreeManager_init(subtreeUpdateVerifier);
    }

    function handleJoinSplit(JoinSplit calldata joinSplit) external {
        _handleJoinSplit(joinSplit);
    }

    function handleRefundNote(
        EncodedAsset memory encodedAsset,
        StealthAddress calldata refundAddr,
        uint256 value
    ) external {
        _handleRefundNote(encodedAsset, refundAddr, value);
    }

    function fillBatchWithZeros() external {
        _fillBatchWithZeros();
    }

    function insertNote(EncodedNote memory note) external {
        _insertNote(note);
    }

    function insertNoteCommitments(uint256[] memory ncs) external {
        _insertNoteCommitments(ncs);
    }
}
