//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

import "../../libs/Types.sol";
import {CommitmentTreeManager} from "../../CommitmentTreeManager.sol";
import {QueueLib} from "../../libs/Queue.sol";

contract TestCommitmentTreeManager is CommitmentTreeManager {
    using QueueLib for QueueLib.Queue;

    function initialize(address subtreeUpdateVerifier) external initializer {
        __CommitmentTreeManager_init(subtreeUpdateVerifier);
    }

    function handleJoinSplits(JoinSplit[] calldata joinSplits) external {
        _handleJoinSplits(joinSplits);
    }

    function handleRefundNotes(
        EncodedAsset[] memory encodedAssets,
        StealthAddress[] memory refundAddrs,
        uint256[] memory values,
        uint256 numRefunds
    ) external {
        _handleRefundNotes(encodedAssets, refundAddrs, values, numRefunds);
    }

    function insertNotes(EncodedNote[] memory notes) external {
        _insertNotes(notes);
    }

    function insertNoteCommitments(uint256[] memory ncs) external {
        _insertNoteCommitments(ncs);
    }

    function currentBatchLen() external view returns (uint256) {
        return _merkle.batchLenPlusOne - 1;
    }

    function accumulatorQueueLen() external view returns (uint256) {
        return _merkle.accumulatorQueue.length();
    }
}
