//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.2;

import "../../interfaces/ISpend2Verifier.sol";
import "./Pairing.sol";

contract TestSpend2Verifier is ISpend2Verifier {
    function verifyProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[8] memory input
    ) external view override returns (bool) {
        return true;
    }
}
