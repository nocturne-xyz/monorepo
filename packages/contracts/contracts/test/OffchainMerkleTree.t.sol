// SPDX-License-Identifier: MIT
pragma solidity ^0.8.5;

import "forge-std/Test.sol";
import {TestUtils} from "./utils/TestUtils.sol";
import {PoseidonDeployer} from "./utils/PoseidonDeployer.sol";
import {OffchainMerkleTree} from "../OffchainMerkleTree.sol";
import {ISubtreeUpdateVerifier} from "../interfaces/ISubtreeUpdateVerifier.sol";
import {TestSubtreeUpdateVerifier} from "./utils/TestSubtreeUpdateVerifier.sol";
import {PoseidonHasherT3} from "../PoseidonHashers.sol";
import {BatchBinaryMerkle} from "../BatchBinaryMerkle.sol";

contract TestOffchainMerkleTree is Test, TestUtils, PoseidonDeployer {
    OffchainMerkleTree merkle;
    BatchBinaryMerkle onChainMerkle;
    ISubtreeUpdateVerifier verifier;

    event LeavesEnqueued(uint256[] leaves);
    event LeavesCommitted(uint128 subtreeIndex, uint256 newRoot);

    function setUp() public virtual {
        deployPoseidon3Through6();
        verifier = new TestSubtreeUpdateVerifier();
        merkle = new OffchainMerkleTree(address(verifier), address(new PoseidonHasherT3(poseidonT3)));
        onChainMerkle = new BatchBinaryMerkle(32, 0, new PoseidonHasherT3(poseidonT3));
    }

    function dummyProof()
        internal
        pure
        returns (uint256[8] memory _values)
    {
        for (uint256 i = 0; i < 8; i++) {
            _values[i] = uint256(4757829);
        }
    }

    function checkInsertBatch(uint256[] memory batch) internal {
        // expect old and new tree to emit the same enqueue events
        vm.expectEmit(true, true, true, true);
        emit LeavesEnqueued(batch);
        merkle.insertLeavesToQueue(batch);

        vm.expectEmit(true, true, true, true);
        emit LeavesEnqueued(batch);
        onChainMerkle.insertLeavesToQueue(batch);

        // insert the additional zeros
        for (uint256 i = batch.length; i < merkle.BATCH_SIZE(); i++) {
            onChainMerkle.insertLeafToQueue(0);
        }

        uint128 subtreeIndex = uint128(onChainMerkle.committedCount());
        // commit the batch to the old tree design to get the expected new root
        onChainMerkle.commit8FromQueue();
        onChainMerkle.commit8FromQueue();
        uint256 newRoot = onChainMerkle.root();

        vm.expectEmit(true, true, true, true);
        emit LeavesCommitted(subtreeIndex, newRoot);
        merkle.commitSubtree(
            newRoot,
            dummyProof()
        );
    }

    function testInsertAndTotalCount() public {
        // batch that's not full
        uint256[] memory batch = new uint256[](8);
        batch[0] = 0;
        batch[1] = 9;
        batch[2] = 0;
        batch[3] = 1;
        batch[4] = 1;
        batch[5] = 4;
        batch[6] = 4;
        batch[7] = 9;
        checkInsertBatch(batch);

        //  batch that's full
        batch = new uint256[](merkle.BATCH_SIZE());
        for (uint256 i = 0; i < merkle.BATCH_SIZE(); i++) {
            batch[i] = i;
        }
        checkInsertBatch(batch);
    }
}
