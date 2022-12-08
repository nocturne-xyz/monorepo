// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.5;
import {IWallet} from "../interfaces/IWallet.sol";

// helpers for converting to/from field elems, uint256s, and/or bytes, and hashing them
library Utils {
    uint256 public constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    // hash array of field elements / uint256s as big-endian bytes with sha256
    function sha256FieldElems(
        uint256[] memory _elems
    ) internal pure returns (bytes32) {
        return sha256(abi.encodePacked(_elems));
    }

    // split a uint256 into 2 limbs, one containing the high (256 - lowerBits) bits, the other containing the lower `lowerBits` bits
    function splitUint256ToLimbs(
        uint256 _n,
        uint256 _lowerBits
    ) internal pure returns (uint256, uint256) {
        uint256 _hi = _n >> _lowerBits;
        uint256 _lo = _n & ((1 << _lowerBits) - 1);
        return (_hi, _lo);
    }

    // return uint256 as two limbs - one uint256 containing the 3 hi bits, the other containing the lower 253 bits
    function uint256ToFieldElemLimbs(
        uint256 _n
    ) internal pure returns (uint256, uint256) {
        return splitUint256ToLimbs(_n, 253);
    }

    function sha256Note(
        IWallet.Note memory _note
    ) internal pure returns (uint256) {
        uint256[] memory _elems = new uint256[](6);
        _elems[0] = _note.ownerH1;
        _elems[1] = _note.ownerH2;
        _elems[2] = _note.nonce;
        _elems[3] = _note.asset;
        _elems[4] = _note.id;
        _elems[5] = _note.value;
        return uint256(sha256FieldElems(_elems));
    }
}
