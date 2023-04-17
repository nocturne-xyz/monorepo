// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {TestCommitmentTreeManager} from "../../harnesses/TestCommitmentTreeManager.sol";
import {IncrementalTree, LibIncrementalTree} from "../../utils/IncrementalTree.sol";
import {TreeUtils} from "../../../libs/TreeUtils.sol";
import "../../../libs/Types.sol";

contract CommitmentTreeManagerHandler {
    using LibIncrementalTree for IncrementalTree;

    // ______PUBLIC______
    TestCommitmentTreeManager public commitmentTreeManager;

    uint256 public ghost_joinSplitLeafCount = 0;
    uint256 public ghost_refundNotesLeafCount = 0;
    uint256 public ghost_fillBatchWithZerosLeafCount = 0;
    uint256 public ghost_insertNoteLeafCount = 0;
    uint256 public ghost_insertNoteCommitmentsLeafCount = 0;

    IncrementalTree _mirrorTree;

    constructor(TestCommitmentTreeManager _commitmentTreeManager) {
        commitmentTreeManager = _commitmentTreeManager;
    }

    function applySubtreeUpdate(
        uint256 newRoot,
        uint256[8] calldata proof
    ) external {
        commitmentTreeManager.applySubtreeUpdate(newRoot, proof);
    }

    function handleJoinSplit(JoinSplit calldata joinSplit) external {
        commitmentTreeManager.handleJoinSplit(joinSplit);

        _mirrorTree.insert(joinSplit.newNoteACommitment);
        _mirrorTree.insert(joinSplit.newNoteBCommitment);
        ghost_joinSplitLeafCount += 2; // call could not have completed without adding 2 leaves
    }

    function handleRefundNote(
        EncodedAsset memory encodedAsset,
        StealthAddress calldata refundAddr,
        uint256 value
    ) external {
        commitmentTreeManager.handleRefundNote(encodedAsset, refundAddr, value);

        // uint256 nc = TreeUtils.sha256Note(note);
        // _mirrorTree.insert(joinSplit.newNoteACommitment);
        ghost_refundNotesLeafCount += 1;
    }

    function fillBatchWithZeros() external {
        uint256 leavesLeft = TreeUtils.BATCH_SIZE -
            commitmentTreeManager.currentBatchLen();
        commitmentTreeManager.fillBatchWithZeros();
        ghost_fillBatchWithZerosLeafCount += leavesLeft;
    }

    function insertNote(EncodedNote memory note) external {
        commitmentTreeManager.insertNote(note);
        ghost_insertNoteLeafCount += 1;
    }

    function insertNoteCommitments(uint256[] memory ncs) external {
        commitmentTreeManager.insertNoteCommitments(ncs);
        ghost_insertNoteCommitmentsLeafCount += ncs.length;
    }
}
