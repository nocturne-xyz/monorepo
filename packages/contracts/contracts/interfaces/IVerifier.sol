//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.5;
import {Pairing} from "../libs/Pairing.sol";

/// @title interface for verifiers that support batch verification.
/// @dev Interface for verifiers that support batch verification.
interface IVerifier {
    struct VerifyingKey {
        Pairing.G1Point alpha1;
        Pairing.G2Point beta2;
        Pairing.G2Point gamma2;
        Pairing.G2Point delta2;
        Pairing.G1Point[] IC;
    }

    struct Proof {
        Pairing.G1Point A;
        Pairing.G2Point B;
        Pairing.G1Point C;
    }

    /// @param proof: the proof to verify
    /// @param pis: an array of containing the public inputs for the proof
    function verifyProof(
        Proof memory proof,
        uint256[] memory pis
    ) external view returns (bool);

    /// @param proofs: an array containing the proofs to verify 
    /// @param pisFlat: an array of length `NUM_PIS * numProofs` containing the PIs for each proof concatenated together
    function batchVerifyProofs(
        Proof[] memory proofs,
        uint256[] memory pisFlat
    ) external view returns (bool);
}