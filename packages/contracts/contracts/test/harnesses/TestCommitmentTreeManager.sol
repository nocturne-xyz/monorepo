//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

import "../../libs/Types.sol";
import {CommitmentTreeManager} from "../../CommitmentTreeManager.sol";

contract TestCommitmentTreeManager is CommitmentTreeManager {
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

    function currentBatchLen() external view returns (uint256) {
        return _merkle.batchLen;
    }
}
