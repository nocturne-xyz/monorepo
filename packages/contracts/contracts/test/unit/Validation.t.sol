// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Test.sol";

import "../../libs/Types.sol";
import {Validation} from "../../libs/Validation.sol";
import {AlgebraicUtils} from "../utils/AlgebraicUtils.sol";

// only for gas
contract TestValidation is Test {
    uint256 constant COMPRESSED_ADDR_H1 =
        16950150798460657717958625567821834550301663161624707787222815936182638968203;

    function testValidateNote() public {
        // Valid note passes
        EncodedNote memory note = EncodedNote(
            COMPRESSED_ADDR_H1,
            COMPRESSED_ADDR_H1,
            1,
            1,
            1,
            1
        );
        Validation.validateNote(note);

        // nonce > field modulus
        EncodedNote memory badNonceNote = note;
        badNonceNote.nonce = type(uint256).max;
        vm.expectRevert("invalid note");
        Validation.validateNote(badNonceNote);

        // value > max
        EncodedNote memory badValueNote = note;
        badValueNote.value = Validation.NOCTURNE_MAX_NOTE_VALUE;
        vm.expectRevert("invalid note");
        Validation.validateNote(badValueNote);

        // asset addr > field modulus
        EncodedNote memory badAssetAddrNote = note;
        badAssetAddrNote.encodedAssetAddr = type(uint256).max;
        vm.expectRevert("invalid note");
        Validation.validateNote(badAssetAddrNote);

        // asset id > field modulus
        EncodedNote memory badAssetIdNote = note;
        badAssetIdNote.encodedAssetId = type(uint256).max;
        vm.expectRevert("invalid note");
        Validation.validateNote(badAssetIdNote);

        // invalid addr points
        EncodedNote memory badOwnerNote = note;
        badOwnerNote.ownerH1 = 0;
        badOwnerNote.ownerH2 = 0;
        vm.expectRevert("invalid point");
        Validation.validateNote(badOwnerNote);
    }

    function testValidateValidPoint() public view {
        Validation.validateCompressedBJJPoint(COMPRESSED_ADDR_H1);
    }

    function testInvalidPointsFail() public {
        vm.expectRevert("invalid point");
        Validation.validateCompressedBJJPoint(0); // (0,0) and (1,0), not on curve

        vm.expectRevert("invalid point");
        Validation.validateCompressedBJJPoint(1); // (1,1) not on curve

        vm.expectRevert("invalid point");
        Validation.validateCompressedBJJPoint(
            AlgebraicUtils.inv(AlgebraicUtils.sqrt(Validation.CURVE_A))
        ); // (0, 1/sqrt(CURVE_A)) (on curve, low order)
    }
}
