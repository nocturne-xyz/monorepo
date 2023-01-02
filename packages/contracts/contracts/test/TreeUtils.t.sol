// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Test.sol";
import {Utils} from "../libs/Utils.sol";
import {TreeUtils} from "../libs/TreeUtils.sol";
import {TestUtils} from "./utils/TestUtils.sol";

contract TestTreeUtils is Test, TestUtils {
    function testEncodePathAndHash() public {
        uint256 idx = 12 * TreeUtils.BATCH_SIZE;
        uint256 accumulatorHash = (1 << 255) - 1;
        (uint256 hi, ) = Utils.uint256ToFieldElemLimbs(accumulatorHash);
        assertEq(3, hi);

        uint256 encodedPathAndhash = TreeUtils.encodePathAndHash(
            uint128(idx),
            hi
        );
        uint256 expected = (3 <<
            (TreeUtils.DEPTH - TreeUtils.BATCH_SUBTREE_DEPTH)) | 12;

        assertEq(expected, encodedPathAndhash);
    }
}
