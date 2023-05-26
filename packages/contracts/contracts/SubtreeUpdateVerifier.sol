// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import {Pairing} from "./libs/Pairing.sol";
import {Groth16} from "./libs/Groth16.sol";
import {ISubtreeUpdateVerifier} from "./interfaces/ISubtreeUpdateVerifier.sol";

contract SubtreeUpdateVerifier is ISubtreeUpdateVerifier {
    function verifyingKey()
        internal
        pure
        returns (Groth16.VerifyingKey memory vk)
    {}

    /// @return r  bool true if proof is valid
    function verifyProof(
        uint256[8] memory proof,
        uint256[] memory pi
    ) public view override returns (bool r) {
        return Groth16.verifyProof(verifyingKey(), proof, pi);
    }

    /// @return r bool true if proofs are valid
    function batchVerifyProofs(
        uint256[8][] memory proofs,
        uint256[][] memory allPis
    ) public view override returns (bool) {
        return Groth16.batchVerifyProofs(verifyingKey(), proofs, allPis);
    }
}
