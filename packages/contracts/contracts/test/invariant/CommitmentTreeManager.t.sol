// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {console} from "forge-std/console.sol";

import {CommitmentTreeManagerHandler} from "./actors/CommitmentTreeManagerHandler.sol";
import {TestCommitmentTreeManager} from "../harnesses/TestCommitmentTreeManager.sol";
import {TestSubtreeUpdateVerifier} from "../harnesses/TestSubtreeUpdateVerifier.sol";

contract CommitmentTreeManagerInvariants is Test {
    CommitmentTreeManagerHandler public commitmentTreeManagerHandler;

    function setUp() public virtual {
        TestSubtreeUpdateVerifier subtreeUpdateVerifier = new TestSubtreeUpdateVerifier();
        TestCommitmentTreeManager commitmentTreeManager = new TestCommitmentTreeManager();
        commitmentTreeManager.initialize(address(subtreeUpdateVerifier));

        commitmentTreeManagerHandler = new CommitmentTreeManagerHandler(
            commitmentTreeManager
        );

        bytes4[] memory selectors = new bytes4[](6);
        selectors[0] = commitmentTreeManagerHandler.applySubtreeUpdate.selector;
        selectors[1] = commitmentTreeManagerHandler.handleJoinSplit.selector;
        selectors[2] = commitmentTreeManagerHandler.handleRefundNote.selector;
        selectors[3] = commitmentTreeManagerHandler.fillBatchWithZeros.selector;
        selectors[4] = commitmentTreeManagerHandler.insertNote.selector;
        selectors[5] = commitmentTreeManagerHandler
            .insertNoteCommitments
            .selector;

        targetContract(address(commitmentTreeManagerHandler));
        targetSelector(
            FuzzSelector({
                addr: address(commitmentTreeManagerHandler),
                selectors: selectors
            })
        );
    }

    function invariant_callSummary() public view {
        commitmentTreeManagerHandler.callSummary();
    }

    function invariant_getTotalCountIsConsistent() external {
        assertEq(
            commitmentTreeManagerHandler.ghost_joinSplitLeafCount() +
                commitmentTreeManagerHandler.ghost_refundNotesLeafCount() +
                commitmentTreeManagerHandler
                    .ghost_fillBatchWithZerosLeafCount() +
                commitmentTreeManagerHandler.ghost_insertNoteLeafCount() +
                commitmentTreeManagerHandler
                    .ghost_insertNoteCommitmentsLeafCount(),
            commitmentTreeManagerHandler.commitmentTreeManager().totalCount()
        );
    }
}
