// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Test.sol";

import {Validation} from "../../libs/Validation.sol";
import {AlgebraicUtils} from "../utils/AlgebraicUtils.sol";

// only for gas
contract TestValidation is Test {
    uint256 constant COMPRESSED_ADDR_H1 =
        16950150798460657717958625567821834550301663161624707787222815936182638968203;

    function testValidateValidPoint() public view {
        Validation.validateCompressedBJJPoint(COMPRESSED_ADDR_H1);
    }

    function testInvalidPointsFail() public {
        vm.expectRevert("invalid point");
        Validation.validateCompressedBJJPoint(0); // (0,0) and (1,0), not on curve

        vm.expectRevert("invalid point");
        Validation.validateCompressedBJJPoint(1); // (1,1) not on curve

        vm.expectRevert("invalid point");
        Validation.validateCompressedBJJPoint(1/AlgebraicUtils.sqrt(Validation.CURVE_A)); // (0, 1/sqrt(CURVE_A)) (on curve, low order)

    }
}
