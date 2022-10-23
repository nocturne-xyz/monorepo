// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "forge-std/Test.sol";
import {TestUtils} from "./utils/TestUtils.sol";
import {PoseidonDeployer} from "./utils/PoseidonDeployer.sol";
import {PoseidonBatchBinaryMerkle} from "../PoseidonBatchBinaryMerkle.sol";
import {IPoseidonT3} from "../interfaces/IPoseidon.sol";

contract TestPoseidonBatchBinaryMerkle is Test, TestUtils, PoseidonDeployer {
    PoseidonBatchBinaryMerkle merkle;

    function setUp() public virtual {
        deployPoseidon3Through6();
        merkle = new PoseidonBatchBinaryMerkle(32, 0, IPoseidonT3(poseidonT3));
    }

    function testInsertAndTentativeCount() public {
        merkle.insertLeafToQueue(uint256(0));
        merkle.insertLeafToQueue(uint256(1));

        assertEq(merkle.tentativeCount(), 2);

        merkle.commit2FromQueue();
        assertEq(merkle.tentativeCount(), 2);

        merkle.insertLeafToQueue(uint256(2));
        merkle.insertLeafToQueue(uint256(3));
        assertEq(merkle.tentativeCount(), 4);
    }
}
