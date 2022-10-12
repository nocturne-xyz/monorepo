// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import "./utils/JsonDecodings.sol";
import {TestUtils} from "./utils/TestUtils.sol";
import {ISpend2Verifier} from "../interfaces/ISpend2Verifier.sol";
import {Spend2Verifier} from "../Spend2Verifier.sol";

contract TestSpend2Verifier is Test, TestUtils {
    using stdJson for string;

    string constant FIXTURE_PATH = "/fixtures/spend2Proof.json";

    ISpend2Verifier verifier;

    function loadFixture() public returns (string memory) {
        string memory root = vm.projectRoot();
        bytes memory path = abi.encodePacked(bytes(root), bytes(FIXTURE_PATH));
        return vm.readFile(string(path));
    }

    function setUp() public virtual {
        verifier = ISpend2Verifier(new Spend2Verifier());
    }

    function testVerify() public {
        string memory json = loadFixture();
        bytes memory proofBytes = json.parseRaw(".proof");
        BaseProof memory proof = abi.decode(proofBytes, (BaseProof));

        uint256[9] memory signals;
        for (uint256 i = 0; i < 7; i++) {
            bytes memory jsonSelector = abi.encodePacked(
                bytes(".publicSignals["),
                Strings.toString(i)
            );
            jsonSelector = abi.encodePacked(jsonSelector, bytes("]"));

            bytes memory signalBytes = json.parseRaw(string(jsonSelector));
            string memory signal = abi.decode(signalBytes, (string));
            signals[i] = parseInt(signal);
        }

        require(
            verifier.verifyProof(
                [parseInt(proof.pi_a[0]), parseInt(proof.pi_a[1])],
                [
                    [parseInt(proof.pi_b[0][1]), parseInt(proof.pi_b[0][0])],
                    [parseInt(proof.pi_b[1][1]), parseInt(proof.pi_b[1][0])]
                ],
                [parseInt(proof.pi_c[0]), parseInt(proof.pi_c[1])],
                [
                    signals[0],
                    signals[1],
                    signals[2],
                    signals[3],
                    signals[4],
                    signals[5],
                    signals[6]
                ]
            ),
            "Invalid proof"
        );
    }
}
