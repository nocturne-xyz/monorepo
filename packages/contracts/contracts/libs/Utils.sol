// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.5;
import {IWallet} from "../interfaces/IWallet.sol";
import {IVerifier} from "../interfaces/IVerifier.sol";
import {Pairing} from "../libs/Pairing.sol";

// helpers for converting to/from field elems, uint256s, and/or bytes, and hashing them
library Utils {
    uint256 public constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    // hash array of field elements / uint256s as big-endian bytes with sha256
    function sha256FieldElems(
        uint256[] memory elems
    ) internal pure returns (bytes32) {
        return sha256(abi.encodePacked(elems));
    }

    // split a uint256 into 2 limbs, one containing the high (256 - lowerBits) bits, the other containing the lower `lowerBits` bits
    function splitUint256ToLimbs(
        uint256 n,
        uint256 lowerBits
    ) internal pure returns (uint256, uint256) {
        uint256 hi = n >> lowerBits;
        uint256 lo = n & ((1 << lowerBits) - 1);
        return (hi, lo);
    }

    // return uint256 as two limbs - one uint256 containing the 3 hi bits, the other containing the lower 253 bits
    function uint256ToFieldElemLimbs(
        uint256 n
    ) internal pure returns (uint256, uint256) {
        return splitUint256ToLimbs(n, 253);
    }

    function sha256Note(
        IWallet.Note memory note
    ) internal pure returns (uint256) {
        uint256[] memory elems = new uint256[](6);
        elems[0] = note.ownerH1;
        elems[1] = note.ownerH2;
        elems[2] = note.nonce;
        elems[3] = note.asset;
        elems[4] = note.id;
        elems[5] = note.value;
        return uint256(sha256FieldElems(elems));
    }

    function proof8ToStruct(
        uint256[8] memory proof
    ) internal pure returns (IVerifier.Proof memory) {
        return
            IVerifier.Proof(
                Pairing.G1Point(proof[0], proof[1]),
                Pairing.G2Point([proof[2], proof[3]], [proof[4], proof[5]]),
                Pairing.G1Point(proof[6], proof[7])
            );
    }
}
