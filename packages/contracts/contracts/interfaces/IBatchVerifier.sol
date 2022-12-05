//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.5;

/// @title interface for verifiers that support batch verification.
/// @dev Interface for verifiers that support batch verification.
interface IBatchVerifier {
    /// @param proofsFlat: an array of length `8 * numProofs` containing the proofs in flattened array form concatenated together
    /// @param pisFlat: an array of length `NUM_PIS * numProofs` containing the PIs for each proof concatenated together
    function batchVerifyProofs(
        uint256[] memory proofsFlat,
        uint256[] memory pisFlat,
        uint256 numProofs
    ) external view returns (bool);
}
