// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;
pragma abicoder v2;

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
        // NOTE: reference sdk/scripts/generateOperationHashTestCase.ts for inputs/expected outputs
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

        TrackedAsset[] memory trackedJoinSplitAssets = new TrackedAsset[](1);
        trackedJoinSplitAssets[0] = TrackedAsset({
            encodedAsset: EncodedAsset({
                encodedAssetAddr: 1,
                encodedAssetId: 1
            }),
            minRefundValue: 1
        });

        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](1);
        trackedRefundAssets[0] = TrackedAsset({
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
            trackedJoinSplitAssets: trackedJoinSplitAssets,
            trackedRefundAssets: trackedRefundAssets,
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

        bytes32 operationHash = tellerBase.hashOperation(operation);

        console.log("operationHash:");
        console.logBytes32(operationHash);
        console.log("");

        bytes32 trackedAssetHash = tellerBase.hashTrackedAsset(
            trackedJoinSplitAssets[0]
        );
        console.log("trackedAssetHash:");
        console.logBytes32(trackedAssetHash);
        console.log("");

        bytes32 encodedAssetHash = tellerBase.hashEncodedAsset(
            trackedJoinSplitAssets[0].encodedAsset
        );
        console.log("encodedAssetHash:");
        console.logBytes32(encodedAssetHash);
        console.log("");

        bytes32 joinSplitHash = tellerBase.hashJoinSplit(joinSplits[0]);
        console.log("joinSplitHash:");
        console.logBytes32(joinSplitHash);
        console.log("");

        // Operation hash generated by running test case gen script in SDK
        assertEq(
            operationHash,
            bytes32(
                0x423766fa67ce615fbf8b8f6cdcc6c326b8f3f551b34db09ae4c79cf7a066cc29
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

        // Operation digest generated by running test case gen script in SDK
        assertEq(
            operationDigest,
            uint256(
                0xd1b2419c96c01ce694c6a6103a410284a4dd628e828d92dae73b0e907e186aa
            )
        );
    }
}
