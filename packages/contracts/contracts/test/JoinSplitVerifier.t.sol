// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;
pragma abicoder v2;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import {JsonDecodings, JoinSplitProofWithPublicSignals} from "./utils/JsonDecodings.sol";
import {ParseUtils} from "./utils/ParseUtils.sol";
import {JoinSplitVerifier} from "../JoinSplitVerifier.sol";
import {IJoinSplitVerifier} from "../interfaces/IJoinSplitVerifier.sol";
import {Groth16} from "../libs/Groth16.sol";
import {Utils} from "../libs/Utils.sol";

contract TestJoinSplitVerifier is Test, ParseUtils, JsonDecodings {
    using stdJson for string;

    string constant BASIC_FIXTURE_PATH = "/fixtures/joinsplitProof.json";
    uint256 constant NUM_PROOFS = 8;
    uint256 constant NUM_PIS = 9;

    IJoinSplitVerifier joinSplitVerifier;

    function setUp() public virtual {
        joinSplitVerifier = IJoinSplitVerifier(new JoinSplitVerifier());
    }

    function loadJoinSplitProof(
        string memory path
    ) internal returns (Groth16.Proof memory proof, uint256[] memory pis) {
        JoinSplitProofWithPublicSignals
            memory proofWithPIs = loadJoinSplitProofFromFixture(path);
        proof = Utils.proof8ToStruct(baseProofTo8(proofWithPIs.proof));
        pis = new uint256[](NUM_PIS);
        for (uint256 i = 0; i < NUM_PIS; i++) {
            pis[i] = proofWithPIs.publicSignals[i];
        }

        return (proof, pis);
    }

    function verifyFixture(string memory path) public {
        (Groth16.Proof memory proof, uint256[] memory pis) = loadJoinSplitProof(
            path
        );

        require(joinSplitVerifier.verifyProof(proof, pis), "Invalid proof");
    }

    function batchVerifyFixture(string memory path) public {
        Groth16.Proof[] memory proofs = new Groth16.Proof[](NUM_PROOFS);
        uint256[][] memory pis = new uint256[][](NUM_PROOFS);
        for (uint256 i = 0; i < NUM_PROOFS; i++) {
            (proofs[i], pis[i]) = loadJoinSplitProof(path);
        }

        require(
            joinSplitVerifier.batchVerifyProofs(proofs, pis),
            "Invalid proof"
        );
    }

    function testBatchVerifySingle() public {
        (Groth16.Proof memory proof, uint256[] memory pis) = loadJoinSplitProof(
            BASIC_FIXTURE_PATH
        );
        Groth16.Proof[] memory proofs = new Groth16.Proof[](1);
        uint256[][] memory allPis = new uint256[][](1);

        proofs[0] = proof;
        allPis[0] = pis;

        require(
            joinSplitVerifier.batchVerifyProofs(proofs, allPis),
            "Invalid proof"
        );
    }

    function testBasicVerify() public {
        verifyFixture(BASIC_FIXTURE_PATH);
    }

    function testBatchVerify() public {
        batchVerifyFixture(BASIC_FIXTURE_PATH);
    }
}
