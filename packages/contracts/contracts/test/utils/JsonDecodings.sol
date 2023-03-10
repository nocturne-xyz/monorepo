// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;
pragma abicoder v2;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "../../libs/Types.sol";
import {ParseUtils} from "./ParseUtils.sol";

struct JoinSplitProofWithPublicSignals {
    uint256[9] publicSignals;
    BaseProof proof;
}

struct SubtreeUpdateProofWithPublicSignals {
    uint256[4] publicSignals;
    BaseProof proof;
}

struct SignedDepositRequest {
    DepositRequest depositRequest;
    string screenerSig;
}

struct SignedDepositRequestFixture {
    string contractName;
    string contractVersion;
    address screenerAddress;
    SignedDepositRequest signedDepositRequest;
}

struct BaseProof {
    string curve;
    string[] pi_a;
    string[][] pi_b;
    string[] pi_c;
    string protocol;
}

contract JsonDecodings is Test, ParseUtils {
    using stdJson for string;

    function loadFixtureJson(
        string memory path
    ) public returns (string memory) {
        string memory root = vm.projectRoot();
        return vm.readFile(string(abi.encodePacked(bytes(root), bytes(path))));
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

    function loadSignedDepositRequestFixture(
        string memory path
    ) public returns (SignedDepositRequestFixture memory) {
        string memory json = loadFixtureJson(path);
        bytes memory contractNameBytes = json.parseRaw(".contractName");
        bytes memory contractVersionBytes = json.parseRaw(".contractVersion");
        bytes memory screenerAddressBytes = json.parseRaw(".screenerAddress");
        string memory contractName = abi.decode(contractNameBytes, (string));
        string memory contractVersion = abi.decode(
            contractVersionBytes,
            (string)
        );
        address screenerAddress = abi.decode(screenerAddressBytes, (address));

        bytes memory signedDepositRequestBytes = json.parseRaw(
            ".signedDepositRequest"
        );
        SignedDepositRequest memory signedDepositRequest = abi.decode(
            signedDepositRequestBytes,
            (SignedDepositRequest)
        );

        return
            SignedDepositRequestFixture({
                contractName: contractName,
                contractVersion: contractVersion,
                screenerAddress: screenerAddress,
                signedDepositRequest: signedDepositRequest
            });
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
}
