//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.5;
import {Groth16} from "../libs/Groth16.sol";

/// @title interface for verifiers that support batch verification.
/// @dev Interface for verifiers that support batch verification.
interface IVerifier {
    /// @param proof: the proof to verify
    /// @param pis: an array of containing the public inputs for the proof
    function verifyProof(
        Groth16.Proof memory proof,
        uint256[] memory pis
    ) external view returns (bool);

    /// @param proofs: an array containing the proofs to verify
    /// @param pis: an array of length `NUM_PIS * numProofs` containing the PIs for each proof concatenated together
    function batchVerifyProofs(
        Groth16.Proof[] memory proofs,
        uint256[][] memory pis
    ) external view returns (bool);
}
