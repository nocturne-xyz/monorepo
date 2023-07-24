// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Test.sol";

import {Utils} from "../../libs/Utils.sol";

// only for gas
contract TestUtils is Test {
    uint256 constant COMPRESSED_ADDR_H1 =
        16950150798460657717958625567821834550301663161624707787222815936182638968203;

    function testValidatePoint() public view {
        Utils.validateCompressedBJJPoint(COMPRESSED_ADDR_H1);
    }
}
