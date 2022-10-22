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

    function testInsert() public {}
}
