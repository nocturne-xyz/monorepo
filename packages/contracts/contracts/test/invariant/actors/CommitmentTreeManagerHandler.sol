// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Test.sol";
import {CommonBase} from "forge-std/Base.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {console} from "forge-std/console.sol";

import {TestCommitmentTreeManager} from "../../harnesses/TestCommitmentTreeManager.sol";
import {IncrementalTree, LibIncrementalTree} from "../../utils/IncrementalTree.sol";
import {EventParsing} from "../../utils/EventParsing.sol";
import {TreeUtils} from "../../../libs/TreeUtils.sol";
import "../../../libs/Types.sol";

contract CommitmentTreeManagerHandler is CommonBase, StdCheats, StdUtils {
    using LibIncrementalTree for IncrementalTree;

    // ______PUBLIC______
    TestCommitmentTreeManager public commitmentTreeManager;

    uint256 public ghost_joinSplitLeafCount = 0;
    uint256 public ghost_refundNotesLeafCount = 0;
    uint256 public ghost_fillBatchWithZerosLeafCount = 0;
    uint256 public ghost_insertNoteLeafCount = 0;
    uint256 public ghost_insertNoteCommitmentsLeafCount = 0;

    // ______INTERNAL______
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
        vm.recordLogs();
        commitmentTreeManager.handleRefundNote(encodedAsset, refundAddr, value);

        // Recover deposit request
        Vm.Log[] memory entries = vm.getRecordedLogs();
        Vm.Log memory entry = entries[entries.length - 1];
        EncodedNote memory note = EventParsing
            .decodeNoteFromRefundProcessedEvent(entry);

        vm.stopPrank();

        uint256 nc = TreeUtils.sha256Note(note);
        _mirrorTree.insert(nc);
        ghost_refundNotesLeafCount += 1;
    }

    function fillBatchWithZeros() external {
        uint256 leavesLeft = TreeUtils.BATCH_SIZE -
            commitmentTreeManager.currentBatchLen();
        commitmentTreeManager.fillBatchWithZeros();

        for (uint256 i = 0; i < leavesLeft; i++) {
            _mirrorTree.insert(0);
        }
        ghost_fillBatchWithZerosLeafCount += leavesLeft;
    }

    function insertNote(EncodedNote memory note) external {
        commitmentTreeManager.insertNote(note);

        uint256 nc = TreeUtils.sha256Note(note);
        _mirrorTree.insert(nc);
        ghost_insertNoteLeafCount += 1;
    }

    function insertNoteCommitments(uint256[] memory ncs) external {
        commitmentTreeManager.insertNoteCommitments(ncs);

        for (uint256 i = 0; i < ncs.length; i++) {
            _mirrorTree.insert(ncs[i]);
        }
        ghost_insertNoteCommitmentsLeafCount += ncs.length;
    }
}
