//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.5;

import "./Pairing.sol";
import {IVerifier} from "../../interfaces/IVerifier.sol";
import {Groth16} from "../../libs/Groth16.sol";

contract TestJoinSplitVerifier is IVerifier {
    function verifyProof(
        Groth16.Proof memory proof,
        uint256[] memory pis
    ) external view override returns (bool) {
        return true;
    }

    function batchVerifyProofs(
        Groth16.Proof[] memory proofs,
        uint256[] memory pisFlat
    ) external view override returns (bool) {
        return true;
    }
}
