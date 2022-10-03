//SPDX-License-Identifier: GPL-3.0
pragma solidity 0.7.6;

/// @title Verifier interface.
/// @dev Interface of Verifier contract.
interface IVerifier {
    function verifyActionProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[7] memory input
    ) external view returns (bool);

    function verifyRefundProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[2] memory input
    ) external view returns (bool);

    function verifySigProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[] memory input
    ) external view returns (bool);
}
