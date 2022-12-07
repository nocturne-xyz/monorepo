// SPDX-License-Identifier: MIT
pragma solidity ^0.8.5;
pragma abicoder v2;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import {JsonDecodings, SubtreeUpdateProofWithPublicSignals} from "./utils/JsonDecodings.sol";
import {TestUtils} from "./utils/TestUtils.sol";
import {Utils} from "../libs/Utils.sol";
import {IVerifier} from "../interfaces/IVerifier.sol";
import {Groth16} from "../libs/Groth16.sol";
import {SubtreeUpdateVerifier} from "../SubtreeUpdateVerifier.sol";

contract TestSubtreeUpdateVerifier is Test, TestUtils, JsonDecodings {
    using stdJson for string;

    string constant BASIC_FIXTURE_PATH = "/fixtures/subtreeupdateProof.json";
    uint256 constant NUM_PROOFS = 8;
    uint256 constant NUM_PIS = 4;

    IVerifier verifier;

    function setUp() public virtual {
        verifier = IVerifier(new SubtreeUpdateVerifier());
    }

    function loadSubtreeUpdateProof(
        string memory path
    ) internal returns (Groth16.Proof memory proof, uint256[] memory pis) {
        SubtreeUpdateProofWithPublicSignals
            memory proofWithPIs = loadSubtreeUpdateProofFromFixture(path);
        proof = Utils.proof8ToStruct(baseProofTo8(proofWithPIs.proof));
        pis = new uint256[](NUM_PIS);
        for (uint256 i = 0; i < NUM_PIS; i++) {
            pis[i] = proofWithPIs.publicSignals[i];
        }

        return (proof, pis);
    }

    function verifyFixture(string memory path) public {
        (
            Groth16.Proof memory proof,
            uint[] memory pis
        ) = loadSubtreeUpdateProof(path);
        require(verifier.verifyProof(proof, pis), "Invalid proof");
    }

    function batchVerifyFixture(string memory path) public {
        Groth16.Proof[] memory proofs = new Groth16.Proof[](NUM_PROOFS);
        uint[] memory pisFlat = new uint256[](NUM_PROOFS * NUM_PIS);
        for (uint256 i = 0; i < NUM_PROOFS; i++) {
            (
                Groth16.Proof memory proof,
                uint[] memory pis
            ) = loadSubtreeUpdateProof(path);
            proofs[i] = proof;
            for (uint256 j = 0; j < NUM_PIS; j++) {
                pisFlat[i * NUM_PIS + j] = pis[j];
            }
        }

        require(verifier.batchVerifyProofs(proofs, pisFlat), "Invalid proof");
    }

    function testBasicVerify() public {
        verifyFixture(BASIC_FIXTURE_PATH);
    }

    function testBatchVerify() public {
        batchVerifyFixture(BASIC_FIXTURE_PATH);
    }
}
