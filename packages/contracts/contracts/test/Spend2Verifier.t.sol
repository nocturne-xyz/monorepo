// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;
pragma abicoder v2;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import {JsonDecodings, Spend2ProofWithPublicSignals} from "./utils/JsonDecodings.sol";
import {TestUtils} from "./utils/TestUtils.sol";
import {ISpend2Verifier} from "../interfaces/ISpend2Verifier.sol";
import {Spend2Verifier} from "../Spend2Verifier.sol";

contract TestSpend2Verifier is Test, TestUtils, JsonDecodings {
    using stdJson for string;

    string constant BASIC_FIXTURE_PATH = "/fixtures/spend2Proof.json";
    string constant E2E_FIXTURE_PATH = "/fixtures/spend2ProofE2E.json";

    ISpend2Verifier verifier;

    function setUp() public virtual {
        verifier = ISpend2Verifier(new Spend2Verifier());
    }

    function loadFixture(string memory path) public returns (string memory) {
        string memory root = vm.projectRoot();
        bytes memory path = abi.encodePacked(bytes(root), bytes(path));
        return vm.readFile(string(path));
    }

    function verifyFixture(string memory path) public {
        Spend2ProofWithPublicSignals memory proof = loadSpend2ProofFromFixture(
            path
        );

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
                    proof.publicSignals[6]
                ]
            ),
            "Invalid proof"
        );
    }

    function testBasicVerify() public {
        verifyFixture(BASIC_FIXTURE_PATH);
    }

    function testE2EVerify() public {
        verifyFixture(E2E_FIXTURE_PATH);
    }
}
