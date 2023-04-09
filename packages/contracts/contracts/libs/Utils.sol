// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.17;
import {IWallet} from "../interfaces/IWallet.sol";
import {Groth16} from "../libs/Groth16.sol";
import {Pairing} from "../libs/Pairing.sol";
import "../libs/Types.sol";

// helpers for converting to/from field elems, uint256s, and/or bytes, and hashing them
library Utils {
    uint256 public constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    // return the minimum of the two values
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return (a >= b) ? b : a;
    }
}
