// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;
pragma abicoder v2;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import "forge-std/console.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import {ParseUtils} from "../utils/ParseUtils.sol";
import "../harnesses/TestTellerBase.sol";
import "../../libs/Types.sol";

contract DepositManagerBaseTest is Test {
    TestTellerBase public tellerBase;

    function testOperationHashMatchesOffchainImpl() public {
        tellerBase = new TestTellerBase();
        tellerBase.initialize("NocturneTeller", "v1");

        EIP712JoinSplit[] memory joinSplits = new EIP712JoinSplit[](1);
        joinSplits[0] = EIP712JoinSplit({
            commitmentTreeRoot: 1,
            nullifierA: 1,
            nullifierB: 1,
            newNoteACommitment: 1,
            newNoteBCommitment: 1,
            senderCommitment: 1,
            encodedAsset: EncodedAsset({
                encodedAssetAddr: 1,
                encodedAssetId: 1
            }),
            publicSpend: 1,
            newNoteAEncrypted: EncryptedNote({
                ciphertextBytes: bytes(""),
                encapsulatedSecretBytes: bytes("")
            }),
            newNoteBEncrypted: EncryptedNote({
                ciphertextBytes: bytes(""),
                encapsulatedSecretBytes: bytes("")
            })
        });

        Action[] memory actions = new Action[](1);
        actions[0] = Action({
            contractAddress: address(
                0x690B9A9E9aa1C9dB991C7721a92d351Db4FaC990
            ),
            encodedFunction: hex"1234"
        });

        EncodedAsset[] memory encodedRefundAssets = new EncodedAsset[](1);
        encodedRefundAssets[0] = EncodedAsset({
            encodedAssetAddr: 1,
            encodedAssetId: 1
        });

        bytes32 joinSplitsArrayHash = tellerBase.hashJoinSplits(joinSplits);
        bytes32 actionsArrayHash = tellerBase.hashActions(actions);
        bytes32 encodedRefundAssetsArrayHash = tellerBase
            .hashEncodedRefundAssets(encodedRefundAssets);
        bytes32 actionHash = tellerBase.hashAction(actions[0]);
        bytes32 encodedFunctionHash = tellerBase.hashEncodedFunction(
            actions[0].encodedFunction
        );

        console.log("joinSplitsArrayHash:");
        console.logBytes32(joinSplitsArrayHash);
        console.log("");

        console.log("actionsArrayHash:");
        console.logBytes32(actionsArrayHash);
        console.log("");

        console.log("encodedRefundAssetsArrayHash:");
        console.logBytes32(encodedRefundAssetsArrayHash);
        console.log("");

        console.log("actionHash:");
        console.logBytes32(actionHash);
        console.log("");

        console.log("encodedFunctionHash:");
        console.logBytes32(encodedFunctionHash);
        console.log("");

        bytes32 operationHash = tellerBase.hashOperation(
            EIP712Operation({
                joinSplits: joinSplits,
                refundAddr: CompressedStealthAddress({h1: 1, h2: 1}),
                encodedRefundAssets: encodedRefundAssets,
                actions: actions,
                encodedGasAsset: EncodedAsset({
                    encodedAssetAddr: 1,
                    encodedAssetId: 1
                }),
                gasAssetRefundThreshold: 1,
                executionGasLimit: 1,
                maxNumRefunds: 1,
                gasPrice: 1,
                chainId: 1,
                deadline: 1,
                atomicActions: true
            })
        );

        console.log("operationHash:");
        console.logBytes32(operationHash);
    }
}
