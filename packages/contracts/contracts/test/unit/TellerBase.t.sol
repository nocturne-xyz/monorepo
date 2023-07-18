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

        JoinSplitWithoutProof[] memory joinSplits = new JoinSplitWithoutProof[](1);
        joinSplits[0] = JoinSplitWithoutProof({
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
        bytes32 gasAssetHash = tellerBase.hashEncodedAsset(
            EncodedAsset({encodedAssetAddr: 1, encodedAssetId: 1})
        );
        bytes32 joinSplitHash = tellerBase.hashJoinSplit(joinSplits[0]);
        bytes32 refundAddrHash = tellerBase.hashCompressedStealthAddress(
            CompressedStealthAddress({h1: 1, h2: 1})
        );

        console.log("Hash of joinSplitsArrayHash:");
        console.logBytes32(keccak256(abi.encodePacked(joinSplitsArrayHash)));
        console.log("");

        console.log("joinSplitsArrayHash:");
        console.logBytes32(joinSplitsArrayHash);
        console.log("");

        console.log("joinSplitHash:");
        console.logBytes32(joinSplitHash);
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

        console.log("gasAssetHash:");
        console.logBytes32(gasAssetHash);
        console.log("");

        console.log("refundAddrHash:");
        console.logBytes32(refundAddrHash);
        console.log("");

        bytes32[] memory actionHashesTest = new bytes32[](1);
        actionHashesTest[0] = actionHash;
        console.log("actionHashesAbiEncodePacked:");
        console.logBytes(abi.encodePacked(actionHashesTest));
        console.log("");

        console.log("actionHashesTest:");
        console.logBytes32(keccak256(abi.encodePacked(actionHashesTest)));
        console.log("");

        OperationWithoutProof memory operation = OperationWithoutProof({
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
        });

        bytes32 operationHash = tellerBase.hashOperation(operation);

        console.log("operationHash:");
        console.logBytes32(operationHash);
        console.log("");

        console.log("Hash of operationHash:");
        console.logBytes32(keccak256(abi.encodePacked(operationHash)));
        console.log("");

        vm.chainId(123);
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

        console.log("chain id:");
        console.logUint(block.chainid);
        console.log("");

        console.log("name hash:");
        console.logBytes32(
            ITestTellerBase(address(0x1111111111111111111111111111111111111111))
                .nameHash()
        );
        console.log("");

        console.log("version hash:");
        console.logBytes32(
            ITestTellerBase(address(0x1111111111111111111111111111111111111111)).versionHash()
        );
        console.log("");

        bytes32 operationDigest = ITestTellerBase(address(0x1111111111111111111111111111111111111111)).computeDigest(operation);

        bytes32 domainSeparator = tellerBase.domainSeparatorV4();
        console.log("domainSeparator:");
        console.logBytes32(domainSeparator);
        console.log("");

        console.log("operationDigest:");
        console.logBytes32(operationDigest);
        console.log("");
    }
}
