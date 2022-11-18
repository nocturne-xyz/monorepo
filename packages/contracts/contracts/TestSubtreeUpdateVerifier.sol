//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.5;

import "./interfaces/ISubtreeUpdateVerifier.sol";
import "./test/utils/Pairing.sol";

contract TestSubtreeUpdateVerifier is ISubtreeUpdateVerifier {
    function verifyProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[4] memory input
    ) external view override returns (bool) {
        return true;
    }
}
