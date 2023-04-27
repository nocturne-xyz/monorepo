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
import {Utils} from "../../../libs/Utils.sol";
import "../../../libs/Types.sol";

contract CommitmentTreeManagerHandler is Test {
    using LibIncrementalTree for IncrementalTree;

    // ______PUBLIC______
    TestCommitmentTreeManager public commitmentTreeManager;

    uint256 public ghost_joinSplitLeafCount = 0;
    uint256 public ghost_refundNotesLeafCount = 0;
    uint256 public ghost_fillBatchWithZerosLeafCount = 0;
    uint256 public ghost_insertNoteLeafCount = 0;
    uint256 public ghost_insertNoteCommitmentsLeafCount = 0;

    bytes32 public lastCall;
    uint256 public preCallTotalCount;
    uint256 public insertNoteCommitmentsLength;
    JoinSplit public lastHandledJoinSplit;

    // ______INTERNAL______
    IncrementalTree _mirrorTree;
    mapping(bytes32 => uint256) internal _calls;
    uint256 internal _rootCounter = 0;
    uint256 internal _nullifierCounter = 0;

    constructor(TestCommitmentTreeManager _commitmentTreeManager) {
        commitmentTreeManager = _commitmentTreeManager;
    }

    modifier trackCall(bytes32 key) {
        preCallTotalCount = commitmentTreeManager.totalCount();

        lastCall = key;
        _;
        _calls[lastCall]++;
    }

    function callSummary() external view {
        console.log("-------------------");
        console.log("CommitmentTreeManagerHandler call summary:");
        console.log("-------------------");
        console.log("applySubtreeUpdate", _calls["applySubtreeUpdate"]);
        console.log("handleJoinSplit", _calls["handleJoinSplit"]);
        console.log("handleRefundNote", _calls["handleRefundNote"]);
        console.log("fillBatchWithZeros", _calls["fillBatchWithZeros"]);
        console.log("insertNote", _calls["insertNote"]);
        console.log("insertNoteCommitments", _calls["insertNoteCommitments"]);
        console.log("no-op", _calls["no-op"]);
    }

    function applySubtreeUpdate(
        uint256[8] memory proof
    ) public trackCall("applySubtreeUpdate") {
        if (commitmentTreeManager.accumulatorQueueLen() > 0) {
            uint256 newRoot = _rootCounter;
            commitmentTreeManager.applySubtreeUpdate(newRoot, proof);
            _rootCounter += 1;
        } else {
            lastCall = "no-op";
        }
    }

    function handleJoinSplit(
        JoinSplit memory joinSplit
    ) public trackCall("handleJoinSplit") {
        joinSplit.commitmentTreeRoot = commitmentTreeManager.root();
        joinSplit.nullifierA = _nullifierCounter;
        joinSplit.nullifierB = _nullifierCounter + 1;
        joinSplit.newNoteACommitment = bound(
            joinSplit.newNoteACommitment,
            0,
            Utils.SNARK_SCALAR_FIELD - 1
        );
        joinSplit.newNoteBCommitment = bound(
            joinSplit.newNoteBCommitment,
            0,
            Utils.SNARK_SCALAR_FIELD - 1
        );
        commitmentTreeManager.handleJoinSplit(joinSplit);

        lastHandledJoinSplit = joinSplit;
        _nullifierCounter += 2;
        ghost_joinSplitLeafCount += 2; // call could not have completed without adding 2 leaves
    }

    function handleRefundNote(
        EncodedAsset memory encodedAsset,
        StealthAddress memory refundAddr,
        uint256 value
    ) public trackCall("handleRefundNote") {
        commitmentTreeManager.handleRefundNote(encodedAsset, refundAddr, value);
        ghost_refundNotesLeafCount += 1;
    }

    function fillBatchWithZeros() public trackCall("fillBatchWithZeros") {
        uint256 leavesLeft = TreeUtils.BATCH_SIZE -
            commitmentTreeManager.currentBatchLen();
        if (leavesLeft != TreeUtils.BATCH_SIZE) {
            commitmentTreeManager.fillBatchWithZeros();
            ghost_fillBatchWithZerosLeafCount += leavesLeft;
        } else {
            lastCall = "no-op";
        }
    }

    function insertNote(
        EncodedNote memory note
    ) public trackCall("insertNote") {
        commitmentTreeManager.insertNote(note);
        ghost_insertNoteLeafCount += 1;
    }

    function insertNoteCommitments(
        uint256[] memory ncs
    ) public trackCall("insertNoteCommitments") {
        for (uint256 i = 0; i < ncs.length; i++) {
            ncs[i] = bound(ncs[i], 0, Utils.SNARK_SCALAR_FIELD - 1);
        }

        commitmentTreeManager.insertNoteCommitments(ncs);
        insertNoteCommitmentsLength = ncs.length;
        ghost_insertNoteCommitmentsLeafCount += ncs.length;
    }
}
