// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Test.sol";
import {TestMemory} from "./harnesses/TestMemory.sol";

contract MemoryTest is Test {
    TestMemory testMemory;

    function setUp() public {
        testMemory = new TestMemory();
    }

    function testMemoryGas() public {
        testMemory.fillMemoryArray2();
        testMemory.fillMemoryArray4();
        testMemory.fillMemoryArray8();
        testMemory.fillMemoryArray16();
        testMemory.fillMemoryArray32();
        testMemory.fillMemoryArray64();
    }
}
