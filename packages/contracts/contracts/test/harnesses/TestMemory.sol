// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract TestMemory {
    function fillMemoryArray2() public pure {
        fillMemoryArray(2);
    }

    function fillMemoryArray4() public pure {
        fillMemoryArray(4);
    }

    function fillMemoryArray8() public pure {
        fillMemoryArray(8);
    }

    function fillMemoryArray16() public pure {
        fillMemoryArray(16);
    }

    function fillMemoryArray32() public pure {
        fillMemoryArray(32);
    }

    function fillMemoryArray64() public pure {
        fillMemoryArray(64);
    }

    function fillMemoryArray(uint256 arraySize) public pure {
        uint256[] memory arr = new uint256[](arraySize);
        for (uint256 i = 0; i < arraySize; i++) {
            arr[i] = i;
        }
    }
}
