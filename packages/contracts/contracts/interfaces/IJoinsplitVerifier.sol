//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.5;

/// @title Verifier interface.
/// @dev Interface of JoinSplit Verifier contract.
interface IJoinsplitVerifier {
    function verifyProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[9] memory input
    ) external view returns (bool);
}
