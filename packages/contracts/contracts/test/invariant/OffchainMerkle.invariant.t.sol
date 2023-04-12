// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {console} from "forge-std/console.sol";

import {OffchainMerkleInvariantHandler} from "./handlers/OffchainMerkleInvariantHandler.sol";
import {TreeUtils} from "../../libs/TreeUtils.sol";

contract OffchainMerkleInvariants is Test {
    OffchainMerkleInvariantHandler public invariantHandler;

    function setUp() public virtual {
        invariantHandler = new OffchainMerkleInvariantHandler();
    }

    function invariant_callSummary() public view {
        invariantHandler.callSummary();
    }

    function invariant_insertedNotesPlusInsertedNoteCommitmentsEqualsTotalCount()
        external
    {
        assertEq(
            invariantHandler.getCount(),
            invariantHandler.getTotalCount() -
                (invariantHandler.accumulatorQueueLength() *
                    TreeUtils.BATCH_SIZE) -
                invariantHandler.batchLen()
        );
    }

    function invariant_getCountAlwaysMultipleOfBatchSize() external {
        assertEq(invariantHandler.getCount() % TreeUtils.BATCH_SIZE, 0);
    }

    function invariant_batchLengthNotExceedingBatchSize() external {
        assertLe(invariantHandler.batchLen(), TreeUtils.BATCH_SIZE);
    }

    function invariant_rootUpdatedAfterSubtreeUpdate() external {
        if (invariantHandler.lastCall() == bytes32("applySubtreeUpdate")) {
            assert(invariantHandler.preCallRoot() != invariantHandler.root());
        } else {
            assertEq(invariantHandler.preCallRoot(), invariantHandler.root());
        }
    }
}
