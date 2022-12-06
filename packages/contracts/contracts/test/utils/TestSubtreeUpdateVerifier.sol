//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.5;

import "../../interfaces/ISubtreeUpdateVerifier.sol";
import "./Pairing.sol";
import {IVerifier} from "../../interfaces/IVerifier.sol";

contract TestSubtreeUpdateVerifier is ISubtreeUpdateVerifier {
    function verifyProof(
        IVerifier.Proof memory proof,
        uint256[] memory pis
    ) external view override returns (bool) {
        return true;
    }

    function batchVerifyProofs(
        IVerifier.Proof[] memory proofs,
        uint256[] memory pisFlat
    ) external view override returns (bool) {
        return true;
    }
}
