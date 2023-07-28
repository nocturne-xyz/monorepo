// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.17;

import "./Types.sol";
import "./Utils.sol";

library Validation {
    uint256 constant CURVE_A = 168700;
    uint256 constant CURVE_D = 168696;
    uint256 constant COMPRESSED_POINT_Y_MASK = ~uint256(1 << 254);

    function validateNote(EncodedNote memory note) internal pure {
        require(
            // encodedAssetAddr is a valid field element
            note.encodedAssetAddr < Utils.BN254_SCALAR_FIELD_MODULUS &&
                // encodedAssetAddr doesn't have any bits set outside bits 0-162 and 250-252
                note.encodedAssetAddr & (~ENCODED_ASSET_ADDR_MASK) == 0 &&
                // encodedAssetId is a 253 bit number (and therefore a valid field element)
                note.encodedAssetId < (1 << 253) &&
                // value is < the 2^252 limit (and therefore a valid field element)
                note.value <= NOCTURNE_MAX_NOTE_VALUE,
            "invalid note"
        );
    }

    function validateCompressedStealthAddress(CompressedStealthAddress calldata addr) internal view {
        validateCompressedBJJPoint(addr.h1);
        validateCompressedBJJPoint(addr.h2);
    }

    function validateCompressedBJJPoint(uint256 p) internal view {
        // Clear X-sign bit. Leaves MSB untouched for the next check.
        uint256 y = p & COMPRESSED_POINT_Y_MASK;
        // Simultaneously check that high-bit is unset, Y is a canonical field element and Y != 0
        // (0, +/- 1/sqrt(A)) is actually on-curve, but is a low-order point and would cause wrap-around below
        require(y > 0 && y < Utils.BN254_SCALAR_FIELD_MODULUS, "invalid point");
        unchecked {
            // y^2
            uint256 y2 = mulmod(y, y, Utils.BN254_SCALAR_FIELD_MODULUS);

            // dy^2
            uint256 dy2 = mulmod(y2, CURVE_D, Utils.BN254_SCALAR_FIELD_MODULUS);

            // dy^2 - A
            uint256 dy2_a = addmod(
                dy2,
                Utils.BN254_SCALAR_FIELD_MODULUS - CURVE_A,
                Utils.BN254_SCALAR_FIELD_MODULUS
            );

            // Integer subtraction is safe here because y^2 == 0 iff y == 0.
            uint256 y2_1 = y2 - 1;

            // Computes (y^2 - 1)(dy^2 - A) instead of (y^2 - 1) / (dy^2 - A) to save an inversion
            // The Legendre symbols are the same since (dy^2 - A) is nonzero and Legendre is multiplicative
            uint256 y2_1dy2_a = mulmod(y2_1, dy2_a, Utils.BN254_SCALAR_FIELD_MODULUS); // (y^2 - 1) * (dy^2 - A)

            // Compute [(y^2 - 1)(dy^2 - A)]^((P - 1)/2) using MODEXP precompile
            // EIP-198 args are <length_of_BASE> <length_of_EXPONENT> <length_of_MODULUS> <BASE> <EXPONENT> <MODULUS>
            bytes memory modexp_args = abi.encodePacked(
                uint256(32),
                uint256(32),
                uint256(32),
                y2_1dy2_a,
                (Utils.BN254_SCALAR_FIELD_MODULUS - 1) / 2,
                Utils.BN254_SCALAR_FIELD_MODULUS
            );
            (bool success, bytes memory response) = address(0x05).staticcall(
                modexp_args
            );
            require(
                success &&
                    uint256(bytes32(response)) == 1 &&
                    mulmod(y2_1, CURVE_A, Utils.BN254_SCALAR_FIELD_MODULUS) !=
                    mulmod(y2, dy2_a, Utils.BN254_SCALAR_FIELD_MODULUS),
                "invalid point"
            );
        }
    }
}