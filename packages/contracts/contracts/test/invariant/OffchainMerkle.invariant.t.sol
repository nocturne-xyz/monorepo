// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {console} from "forge-std/console.sol";

import {OffchainMerkleHandler} from "./actors/OffchainMerkleHandler.sol";
import {TreeUtils} from "../../libs/TreeUtils.sol";

contract OffchainMerkleInvariants is Test {
    OffchainMerkleHandler public offchainMerkleHandler;

    function setUp() public virtual {
        offchainMerkleHandler = new OffchainMerkleHandler();
    }

    function invariant_callSummary() public view {
        offchainMerkleHandler.callSummary();
    }

    function invariant_insertedNotesPlusInsertedNoteCommitmentsEqualsTotalCount()
        external
    {
        assertEq(
            offchainMerkleHandler.getCount(),
            offchainMerkleHandler.getTotalCount() -
                (offchainMerkleHandler.accumulatorQueueLength() *
                    TreeUtils.BATCH_SIZE) -
                offchainMerkleHandler.batchLen()
        );
    }

    function invariant_getCountAlwaysMultipleOfBatchSize() external {
        assertEq(offchainMerkleHandler.getCount() % TreeUtils.BATCH_SIZE, 0);
    }

    function invariant_batchLengthNotExceedingBatchSize() external {
        assertLt(offchainMerkleHandler.batchLen(), TreeUtils.BATCH_SIZE);
    }

    function invariant_rootUpdatedAfterSubtreeUpdate() external {
        if (offchainMerkleHandler.lastCall() == bytes32("applySubtreeUpdate")) {
            assert(
                offchainMerkleHandler.preCallRoot() !=
                    offchainMerkleHandler.root()
            );
        } else {
            assertEq(
                offchainMerkleHandler.preCallRoot(),
                offchainMerkleHandler.root()
            );
        }
    }
}
