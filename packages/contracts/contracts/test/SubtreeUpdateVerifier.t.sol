// SPDX-License-Identifier: MIT
pragma solidity ^0.8.5;
pragma abicoder v2;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import {JsonDecodings, SubtreeUpdateProofWithPublicSignals} from "./utils/JsonDecodings.sol";
import {TestUtils} from "./utils/TestUtils.sol";
import {ISubtreeUpdateVerifier} from "../interfaces/ISubtreeUpdateVerifier.sol";
import {SubtreeUpdateVerifier} from "../SubtreeUpdateVerifier.sol";

contract TestSubtreeUpdateVerifier is Test, TestUtils, JsonDecodings {
    using stdJson for string;

    string constant BASIC_FIXTURE_PATH = "/fixtures/subtreeupdateProof.json";

    ISubtreeUpdateVerifier verifier;

    function setUp() public virtual {
        verifier = ISubtreeUpdateVerifier(new SubtreeUpdateVerifier());
    }

    function verifyFixture(string memory path) public {
        SubtreeUpdateProofWithPublicSignals
            memory proof = loadSubtreeUpdateProofFromFixture(path);

        require(
            verifier.verifyProof(
                [parseInt(proof.proof.pi_a[0]), parseInt(proof.proof.pi_a[1])],
                [
                    [
                        parseInt(proof.proof.pi_b[0][1]),
                        parseInt(proof.proof.pi_b[0][0])
                    ],
                    [
                        parseInt(proof.proof.pi_b[1][1]),
                        parseInt(proof.proof.pi_b[1][0])
                    ]
                ],
                [parseInt(proof.proof.pi_c[0]), parseInt(proof.proof.pi_c[1])],
                [
                    proof.publicSignals[0],
                    proof.publicSignals[1],
                    proof.publicSignals[2],
                    proof.publicSignals[3]
                ]
            ),
            "Invalid proof"
        );
    }

    function testBasicVerify() public {
        verifyFixture(BASIC_FIXTURE_PATH);
    }
}
