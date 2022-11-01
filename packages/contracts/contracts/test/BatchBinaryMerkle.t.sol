// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "forge-std/Test.sol";
import {TestUtils} from "./utils/TestUtils.sol";
import {PoseidonDeployer} from "./utils/PoseidonDeployer.sol";
import {BatchBinaryMerkle} from "../BatchBinaryMerkle.sol";
import {PoseidonHasherT3} from "../PoseidonHashers.sol";

contract TestBatchBinaryMerkle is Test, TestUtils, PoseidonDeployer {
    BatchBinaryMerkle merkle;

    event LeavesEnqueued(uint256[] indexed leaves);

    function setUp() public virtual {
        deployPoseidon3Through6();
        merkle = new BatchBinaryMerkle(32, 0, new PoseidonHasherT3(poseidonT3));
    }

    function testInsertAndTotalCount() public {
        // Expect two separate LeavesEnqueued to be committed
        vm.expectEmit(true, true, true, true);
        uint256[] memory eventLeaves1 = new uint256[](1);
        eventLeaves1[0] = uint256(0);
        emit LeavesEnqueued(eventLeaves1);

        vm.expectEmit(true, true, true, true);
        uint256[] memory eventLeaves2 = new uint256[](1);
        eventLeaves2[0] = uint256(1);
        emit LeavesEnqueued(eventLeaves2);

        // Enqueue the two leaves and ensure counts are consistent
        merkle.insertLeafToQueue(uint256(0));
        merkle.insertLeafToQueue(uint256(1));
        assertEq(merkle.totalCount(), 2);
        assertEq(merkle.committedCount(), 0);

        // Commit 2 leaves check counts
        merkle.commit2FromQueue();
        assertEq(merkle.committedCount(), 2);
        assertEq(merkle.totalCount(), 2);

        // Create batch of 8 leaves to insert to queue
        uint256[] memory batchLeaves = new uint256[](8);
        for (uint256 i = 0; i < 8; i++) {
            batchLeaves[i] = i;
        }

        // Expect batch of 8 event leaves to be enqueued
        vm.expectEmit(true, true, true, true);
        emit LeavesEnqueued(batchLeaves);

        // Enqueue batch of 8
        merkle.insertLeavesToQueue(batchLeaves);
        assertEq(merkle.totalCount(), 10);

        merkle.commit8FromQueue();
        assertEq(merkle.totalCount(), 10);
    }
}
