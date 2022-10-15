// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.2;
pragma abicoder v2;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import {TestUtils} from "./TestUtils.sol";

struct Spend2ProofWithPublicSignals {
    uint256[7] publicSignals;
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

    function loadFixtureJson(string memory path)
        public
        returns (string memory)
    {
        string memory root = vm.projectRoot();
        bytes memory path = abi.encodePacked(bytes(root), bytes(path));
        return vm.readFile(string(path));
    }

    function loadSpend2ProofFromFixture(string memory path)
        public
        returns (Spend2ProofWithPublicSignals memory)
    {
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

    function spend2BaseProofToProof8(BaseProof memory proof)
        public
        returns (uint256[8] memory)
    {
        // uint256[8] memory p;
        // p[0] = proof.pi_a[0];
        // p[1] = proof.pi_a[1];
        // p[2] = proof.pi_b[0][1];
        // p[3] = proof.pi_b[0][0];
        // p[4] = proof.pi_b[1][1];
        // p[5] = proof.pi_b[1][0];
        // p[6] = proof.pi_c[0];
        // p[7] = proof.pi_c[1];

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
