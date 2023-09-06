// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.2;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import "forge-std/console.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import {ParseUtils} from "../utils/ParseUtils.sol";
import "../harnesses/TestOperationEIP712.sol";
import "../../libs/Types.sol";

contract OperationEIP712Test is Test {
    TestOperationEIP712 public tellerBase;

    function testOperationHashMatchesOffchainImpl() public {
        // NOTE: reference core/scripts/genOperationHashTestCase.ts for inputs/expected outputs
        tellerBase = new TestOperationEIP712();
        tellerBase.initialize("NocturneTeller", "v1");

        uint256[8] memory dummyProof;
        JoinSplit[] memory joinSplits = new JoinSplit[](1);
        joinSplits[0] = JoinSplit({
            commitmentTreeRoot: 1,
            nullifierA: 1,
            nullifierB: 1,
            newNoteACommitment: 1,
            newNoteBCommitment: 1,
            senderCommitment: 1,
            proof: dummyProof,
            newNoteAEncrypted: EncryptedNote({
                ciphertextBytes: bytes(""),
                encapsulatedSecretBytes: bytes("")
            }),
            newNoteBEncrypted: EncryptedNote({
                ciphertextBytes: bytes(""),
                encapsulatedSecretBytes: bytes("")
            })
        });

        PublicJoinSplit[] memory pubJoinSplits = new PublicJoinSplit[](1);
        pubJoinSplits[0] = PublicJoinSplit({
            joinSplit: joinSplits[0],
            assetIndex: 1,
            publicSpend: 1
        });

        Action[] memory actions = new Action[](1);
        actions[0] = Action({
            contractAddress: address(
                0x690B9A9E9aa1C9dB991C7721a92d351Db4FaC990
            ),
            encodedFunction: hex"1234"
        });

        TrackedAsset[] memory trackedAssets = new TrackedAsset[](1);
        trackedAssets[0] = TrackedAsset({
            encodedAsset: EncodedAsset({
                encodedAssetAddr: 1,
                encodedAssetId: 1
            }),
            minRefundValue: 1
        });

        Operation memory operation = Operation({
            pubJoinSplits: pubJoinSplits,
            confJoinSplits: joinSplits,
            refundAddr: CompressedStealthAddress({h1: 1, h2: 1}),
            trackedAssets: trackedAssets,
            actions: actions,
            encodedGasAsset: EncodedAsset({
                encodedAssetAddr: 1,
                encodedAssetId: 1
            }),
            gasAssetRefundThreshold: 1,
            executionGasLimit: 1,
            gasPrice: 1,
            deadline: 1,
            atomicActions: true
        });

        bytes32 trackedAssetHash = tellerBase.hashTrackedAsset(
            trackedAssets[0]
        );
        console.log("trackedAssetHash:");
        console.logBytes32(trackedAssetHash);
        console.log("");

        bytes32 encodedAssetHash = tellerBase.hashEncodedAsset(
            trackedAssets[0].encodedAsset
        );
        console.log("encodedAssetHash:");
        console.logBytes32(encodedAssetHash);
        console.log("");

        bytes32 joinSplitHash = tellerBase.hashJoinSplit(joinSplits[0]);
        console.log("joinSplitHash:");
        console.logBytes32(joinSplitHash);
        console.log("");

        bytes32 joinSplitsArrayHash = tellerBase.hashJoinSplits(joinSplits);
        console.log("joinSplitsArrayHash:");
        console.logBytes32(joinSplitsArrayHash);
        console.log("");

        bytes32 publicJoinSplitHash = tellerBase.hashPublicJoinSplit(
            pubJoinSplits[0]
        );
        console.log("publicJoinSplitHash:");
        console.logBytes32(publicJoinSplitHash);
        console.log("");

        bytes32 publicJoinSplitArrayHash = tellerBase.hashPublicJoinSplits(
            pubJoinSplits
        );
        console.log("publicJoinSplitArrayHash:");
        console.logBytes32(publicJoinSplitArrayHash);
        console.log("");

        bytes32 hashOfPublicJoinSplitsArrayHash = keccak256(
            abi.encodePacked(publicJoinSplitArrayHash)
        );
        console.log("hashOfPublicJoinSplitsArrayHash:");
        console.logBytes32(hashOfPublicJoinSplitsArrayHash);
        console.log("");

        bytes32 hashOfJoinSplitsArrayHash = keccak256(
            abi.encodePacked(joinSplitsArrayHash)
        );
        console.log("hashOfJoinSplitsArrayHash:");
        console.logBytes32(hashOfJoinSplitsArrayHash);
        console.log("");

        bytes32 operationHash = tellerBase.hashOperation(operation);

        console.log("operationHash:");
        console.logBytes32(operationHash);
        console.log("");

        // Operation hash generated by running test case gen script in core
        assertEq(
            operationHash,
            bytes32(
                0xd48b43d3583d7d4afecb8fdd8ffa70e5f0280927c627afb91d5f313b4120d86d
            )
        );

        vm.chainId(1);
        vm.etch(
            address(0x1111111111111111111111111111111111111111),
            address(tellerBase).code
        );
        vm.store(
            address(0x1111111111111111111111111111111111111111),
            bytes32(uint256(1)),
            keccak256(bytes("NocturneTeller"))
        );
        vm.store(
            address(0x1111111111111111111111111111111111111111),
            bytes32(uint256(2)),
            keccak256(bytes("v1"))
        );

        uint256 operationDigest = ITestOperationEIP712(
            address(0x1111111111111111111111111111111111111111)
        ).computeDigest(operation);

        console.log("operationDigest:");
        console.logBytes32(bytes32(operationDigest));
        console.log("");

        // Operation digest generated by running test case gen script in core
        assertEq(
            operationDigest,
            uint256(
                0x5542656472b4c63f2699db47e8f8f2779645b1764d92c69281ad06641ef866a
            )
        );
    }
}
