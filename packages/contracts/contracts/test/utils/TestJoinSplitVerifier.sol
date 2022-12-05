//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.5;

import "../../interfaces/IJoinSplitVerifier.sol";
import "./Pairing.sol";

contract TestJoinSplitVerifier is IJoinSplitVerifier {
    function verifyProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[9] memory input
    ) external view override returns (bool) {
        return true;
    }

    function batchVerifyProofs(
        uint256[] memory proofsFlat,
        uint256[] memory pisFlat,
        uint256 numProofs
    ) external view override returns (bool) {
        return true;
    }
}
