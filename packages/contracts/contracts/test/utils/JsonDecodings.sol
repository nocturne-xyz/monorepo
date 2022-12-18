// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;
pragma abicoder v2;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import {TestUtils} from "./TestUtils.sol";

struct JoinSplitProofWithPublicSignals {
    uint256[9] publicSignals;
    BaseProof proof;
}

struct Spend2ProofWithPublicSignals {
    uint256[7] publicSignals;
    BaseProof proof;
}

struct SubtreeUpdateProofWithPublicSignals {
    uint256[4] publicSignals;
    BaseProof proof;
}

struct BaseProof {
    string curve;
    string[] pi_a;
    string[][] pi_b;
    string[] pi_c;
    string protocol;
}

contract JsonDecodings is Test, TestUtils {
    using stdJson for string;

    function loadFixtureJson(
        string memory path
    ) public returns (string memory) {
        string memory root = vm.projectRoot();
        return vm.readFile(string(abi.encodePacked(bytes(root), bytes(path))));
    }

    function loadSpend2ProofFromFixture(
        string memory path
    ) public returns (Spend2ProofWithPublicSignals memory) {
        string memory json = loadFixtureJson(path);
        bytes memory proofBytes = json.parseRaw(".proof");
        BaseProof memory proof = abi.decode(proofBytes, (BaseProof));

        uint256[7] memory publicSignals;
        for (uint256 i = 0; i < 7; i++) {
            bytes memory jsonSelector = abi.encodePacked(
                bytes(".publicSignals["),
                Strings.toString(i)
            );
            jsonSelector = abi.encodePacked(jsonSelector, bytes("]"));

            bytes memory signalBytes = json.parseRaw(string(jsonSelector));
            string memory signal = abi.decode(signalBytes, (string));
            publicSignals[i] = parseInt(signal);
        }

        return
            Spend2ProofWithPublicSignals({
                publicSignals: publicSignals,
                proof: proof
            });
    }

    function loadSubtreeUpdateProofFromFixture(
        string memory path
    ) public returns (SubtreeUpdateProofWithPublicSignals memory) {
        string memory json = loadFixtureJson(path);
        bytes memory proofBytes = json.parseRaw(".proof");
        BaseProof memory proof = abi.decode(proofBytes, (BaseProof));

        uint256[4] memory publicSignals;
        for (uint256 i = 0; i < 4; i++) {
            bytes memory jsonSelector = abi.encodePacked(
                bytes(".publicSignals["),
                Strings.toString(i)
            );
            jsonSelector = abi.encodePacked(jsonSelector, bytes("]"));

            bytes memory signalBytes = json.parseRaw(string(jsonSelector));
            string memory signal = abi.decode(signalBytes, (string));
            publicSignals[i] = parseInt(signal);
        }

        return
            SubtreeUpdateProofWithPublicSignals({
                publicSignals: publicSignals,
                proof: proof
            });
    }

    function baseProofTo8(
        BaseProof memory proof
    ) public pure returns (uint256[8] memory) {
        return [
            parseInt(proof.pi_a[0]),
            parseInt(proof.pi_a[1]),
            parseInt(proof.pi_b[0][1]),
            parseInt(proof.pi_b[0][0]),
            parseInt(proof.pi_b[1][1]),
            parseInt(proof.pi_b[1][0]),
            parseInt(proof.pi_c[0]),
            parseInt(proof.pi_c[1])
        ];
    }

    function loadJoinSplitProofFromFixture(
        string memory path
    ) public returns (JoinSplitProofWithPublicSignals memory) {
        string memory json = loadFixtureJson(path);
        bytes memory proofBytes = json.parseRaw(".proof");
        BaseProof memory proof = abi.decode(proofBytes, (BaseProof));

        uint256[9] memory publicSignals;
        for (uint256 i = 0; i < 9; i++) {
            bytes memory jsonSelector = abi.encodePacked(
                bytes(".publicSignals["),
                Strings.toString(i)
            );
            jsonSelector = abi.encodePacked(jsonSelector, bytes("]"));

            bytes memory signalBytes = json.parseRaw(string(jsonSelector));
            string memory signal = abi.decode(signalBytes, (string));
            publicSignals[i] = parseInt(signal);
        }

        return
            JoinSplitProofWithPublicSignals({
                publicSignals: publicSignals,
                proof: proof
            });
    }

    function joinsplitBaseProofToProof8(
        BaseProof memory proof
    ) public pure returns (uint256[8] memory) {
        return [
            parseInt(proof.pi_a[0]),
            parseInt(proof.pi_a[1]),
            parseInt(proof.pi_b[0][1]),
            parseInt(proof.pi_b[0][0]),
            parseInt(proof.pi_b[1][1]),
            parseInt(proof.pi_b[1][0]),
            parseInt(proof.pi_c[0]),
            parseInt(proof.pi_c[1])
        ];
    }
}
