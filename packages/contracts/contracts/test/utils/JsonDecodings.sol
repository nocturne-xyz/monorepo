// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;
pragma abicoder v2;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import "forge-std/console.sol";
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

struct SignedDepositRequestFixture {
    address contractAddress;
    string contractName;
    string contractVersion;
    address screenerAddress;
    DepositRequest depositRequest;
    bytes32 depositRequestHash;
    bytes signature;
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

    struct SimpleSignedDepositRequestTypes {
        uint256 chainId;
        address spender;
        uint256 value;
        uint256 nonce;
        uint256 gasCompensation;
    }

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
        bytes memory contractAddressBytes = json.parseRaw(".contractAddress");
        bytes memory contractNameBytes = json.parseRaw(".contractName");
        bytes memory contractVersionBytes = json.parseRaw(".contractVersion");
        bytes memory screenerAddressBytes = json.parseRaw(".screenerAddress");
        bytes memory depositRequestHashBytes = json.parseRaw(
            ".depositRequestHash"
        );
        address contractAddress = abi.decode(contractAddressBytes, (address));
        string memory contractName = abi.decode(contractNameBytes, (string));
        string memory contractVersion = abi.decode(
            contractVersionBytes,
            (string)
        );
        address screenerAddress = abi.decode(screenerAddressBytes, (address));
        bytes32 depositRequestHash = abi.decode(
            depositRequestHashBytes,
            (bytes32)
        );

        // NOTE: helper struct only used to reduce stack usage
        SimpleSignedDepositRequestTypes
            memory simpleTypes = extractSimpleSignedDepositRequestTypes(json);

        EncodedAsset memory encodedAsset = extractEncodedAsset(json);
        StealthAddress memory depositAddr = extractDepositAddr(json);
        bytes memory signature = extractSignature(json);

        return
            SignedDepositRequestFixture({
                contractAddress: contractAddress,
                contractName: contractName,
                contractVersion: contractVersion,
                screenerAddress: screenerAddress,
                depositRequest: DepositRequest({
                    chainId: simpleTypes.chainId,
                    spender: simpleTypes.spender,
                    encodedAsset: encodedAsset,
                    value: simpleTypes.value,
                    depositAddr: depositAddr,
                    nonce: simpleTypes.nonce,
                    gasCompensation: simpleTypes.gasCompensation
                }),
                depositRequestHash: depositRequestHash,
                signature: signature
            });
    }

    function extractSimpleSignedDepositRequestTypes(
        string memory json
    ) public returns (SimpleSignedDepositRequestTypes memory) {
        uint256 chainId = parseInt(json.readString(".depositRequest.chainId"));
        address spender = json.readAddress(".depositRequest.spender");
        uint256 value = parseInt(json.readString(".depositRequest.value"));
        uint256 nonce = parseInt(json.readString(".depositRequest.nonce"));
        uint256 gasCompensation = parseInt(
            json.readString(".depositRequest.gasCompensation")
        );

        return
            SimpleSignedDepositRequestTypes({
                chainId: chainId,
                spender: spender,
                value: value,
                nonce: nonce,
                gasCompensation: gasCompensation
            });
    }

    function extractEncodedAsset(
        string memory json
    ) public returns (EncodedAsset memory) {
        uint256 encodedAssetAddr = parseInt(
            json.readString(".depositRequest.encodedAsset.encodedAssetAddr")
        );
        uint256 encodedAssetId = parseInt(
            json.readString(".depositRequest.encodedAsset.encodedAssetId")
        );

        return
            EncodedAsset({
                encodedAssetAddr: encodedAssetAddr,
                encodedAssetId: encodedAssetId
            });
    }

    function extractDepositAddr(
        string memory json
    ) public returns (StealthAddress memory) {
        uint256 h1X = parseInt(
            json.readString(".depositRequest.depositAddr.h1X")
        );
        uint256 h1Y = parseInt(
            json.readString(".depositRequest.depositAddr.h1Y")
        );
        uint256 h2X = parseInt(
            json.readString(".depositRequest.depositAddr.h2X")
        );
        uint256 h2Y = parseInt(
            json.readString(".depositRequest.depositAddr.h2Y")
        );

        return StealthAddress({h1X: h1X, h1Y: h1Y, h2X: h2X, h2Y: h2Y});
    }

    // NOTE: we encode to rsv because foundry cannot parse 132 char byte string
    function extractSignature(
        string memory json
    ) public returns (bytes memory) {
        uint256 r = json.readUint(".signature.r");
        uint256 s = json.readUint(".signature.s");
        uint8 v = uint8(json.readUint(".signature.v"));
        bytes memory sig = rsvToSignatureBytes(r, s, v);

        console.logBytes(sig);
        return sig;
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
