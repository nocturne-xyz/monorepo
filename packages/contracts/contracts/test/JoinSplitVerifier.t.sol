// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;
pragma abicoder v2;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import {JsonDecodings, JoinSplitProofWithPublicSignals} from "./utils/JsonDecodings.sol";
import {TestUtils} from "./utils/TestUtils.sol";
import {IJoinSplitVerifier} from "../interfaces/IJoinSplitVerifier.sol";
import {JoinSplitVerifier} from "../JoinSplitVerifier.sol";

contract TestJoinSplitVerifier is Test, TestUtils, JsonDecodings {
    using stdJson for string;

    string constant BASIC_FIXTURE_PATH = "/fixtures/joinsplitProof.json";

    IJoinSplitVerifier verifier;

    function setUp() public virtual {
        verifier = IJoinSplitVerifier(new JoinSplitVerifier());
    }

    function verifyFixture(string memory path) public {
        JoinSplitProofWithPublicSignals
            memory proof = loadJoinSplitProofFromFixture(path);

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
                    proof.publicSignals[3],
                    proof.publicSignals[4],
                    proof.publicSignals[5],
                    proof.publicSignals[6],
                    proof.publicSignals[7],
                    proof.publicSignals[8]
                ]
            ),
            "Invalid proof"
        );
    }

    function testBasicVerify() public {
        verifyFixture(BASIC_FIXTURE_PATH);
    }
}
