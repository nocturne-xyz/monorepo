//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

import "../../libs/Types.sol";
import {AssetUtils} from "../../libs/AssetUtils.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

uint256 constant GAS_PER_JOINSPLIT_VERIFY = 100_000;

enum OperationFailureType {
    NONE,
    JOINSPLIT_BAD_ROOT,
    JOINSPLIT_NF_ALREADY_IN_SET,
    JOINSPLIT_NFS_SAME,
    BAD_CHAIN_ID,
    EXPIRED_DEADLINE
}

struct FormatOperationArgs {
    address[] joinSplitTokens;
    uint256[] joinSplitRefundValues;
    uint256[][] joinSplitsPublicSpends;
    address gasToken;
    uint256 root;
    TrackedAsset[] trackedRefundAssets;
    uint256 gasAssetRefundThreshold;
    uint256 executionGasLimit;
    uint256 gasPrice;
    Action[] actions;
    bool atomicActions;
    OperationFailureType operationFailureType;
}

struct TransferRequest {
    address token;
    address recipient;
    uint256 amount;
}

library NocturneUtils {
    uint256 constant ERC20_ID = 0;
    uint256 constant DEADLINE_BUFFER = 1000;

    function defaultStealthAddress()
        internal
        pure
        returns (CompressedStealthAddress memory)
    {
        return CompressedStealthAddress({h1: 1938477, h2: 1032988});
    }

    function dummyProof() internal pure returns (uint256[8] memory _values) {
        for (uint256 i = 0; i < 8; i++) {
            _values[i] = uint256(4757829);
        }
    }

    function fillJoinSplitPublicSpends(
        uint256 perJoinSplitPublicSpend,
        uint256 numJoinSplits
    ) internal pure returns (uint256[] memory) {
        uint256[] memory joinSplitPublicSpends = new uint256[](numJoinSplits);
        for (uint256 i = 0; i < numJoinSplits; i++) {
            joinSplitPublicSpends[i] = perJoinSplitPublicSpend;
        }
        return joinSplitPublicSpends;
    }

    function formatDepositRequest(
        address spender,
        address asset,
        uint256 value,
        uint256 id,
        CompressedStealthAddress memory depositAddr,
        uint256 nonce,
        uint256 gasCompensation
    ) internal pure returns (DepositRequest memory) {
        EncodedAsset memory encodedAsset = AssetUtils.encodeAsset(
            AssetType.ERC20,
            asset,
            id
        );

        return
            DepositRequest({
                spender: spender,
                encodedAsset: encodedAsset,
                value: value,
                depositAddr: depositAddr,
                nonce: nonce,
                gasCompensation: gasCompensation
            });
    }

    function formatDeposit(
        address spender,
        address asset,
        uint256 value,
        uint256 id,
        CompressedStealthAddress memory depositAddr
    ) internal pure returns (Deposit memory) {
        EncodedAsset memory encodedAsset = AssetUtils.encodeAsset(
            AssetType.ERC20,
            asset,
            id
        );

        return
            Deposit({
                spender: spender,
                encodedAsset: encodedAsset,
                value: value,
                depositAddr: depositAddr
            });
    }

    function formatSingleTransferActionArray(
        address token,
        address recipient,
        uint256 amount
    ) public pure returns (Action[] memory) {
        Action[] memory actions = new Action[](1);
        actions[0] = formatTransferAction(
            TransferRequest({
                token: token,
                recipient: recipient,
                amount: amount
            })
        );
        return actions;
    }

    function formatTransferAction(
        TransferRequest memory transferRequest
    ) public pure returns (Action memory) {
        return
            Action({
                contractAddress: address(transferRequest.token),
                encodedFunction: abi.encodeWithSelector(
                    IERC20(transferRequest.token).transfer.selector,
                    transferRequest.recipient,
                    transferRequest.amount
                )
            });
    }

    function formatOperation(
        FormatOperationArgs memory args
    ) internal view returns (Operation memory) {
        uint256 totalNumJoinSplits = _totalNumJoinSplitsForArgs(args);
        OperationFailureType operationFailure = args.operationFailureType;
        if (operationFailure == OperationFailureType.JOINSPLIT_BAD_ROOT) {
            args.root = 0x12345; // fill with garbage root
        } else if (
            operationFailure == OperationFailureType.JOINSPLIT_NF_ALREADY_IN_SET
        ) {
            require(
                totalNumJoinSplits >= 2,
                "Must specify at least 2 joinsplits for JOINSPLIT_NF_ALREADY_IN_SET failure type"
            );
        }

        uint256 root = args.root;
        EncryptedNote memory newNoteAEncrypted = _dummyEncryptedNote();
        EncryptedNote memory newNoteBEncrypted = _dummyEncryptedNote();

        JoinSplit[] memory joinSplits = new JoinSplit[](totalNumJoinSplits);

        uint256 currentIndex = 0;
        for (uint256 i = 0; i < args.joinSplitsPublicSpends.length; i++) {
            for (
                uint256 j = 0;
                j < args.joinSplitsPublicSpends[i].length;
                j++
            ) {
                joinSplits[currentIndex] = JoinSplit({
                    commitmentTreeRoot: root,
                    nullifierA: uint256(2 * currentIndex),
                    nullifierB: uint256(2 * currentIndex + 1),
                    newNoteACommitment: uint256(currentIndex),
                    newNoteAEncrypted: newNoteAEncrypted,
                    newNoteBCommitment: uint256(currentIndex),
                    newNoteBEncrypted: newNoteBEncrypted,
                    senderCommitment: uint256(currentIndex),
                    proof: dummyProof(),
                    assetIndex: uint8(i),
                    publicSpend: args.joinSplitsPublicSpends[i][j]
                });
                currentIndex++;
            }
        }

        operationFailure = args.operationFailureType;
        if (operationFailure == OperationFailureType.JOINSPLIT_NFS_SAME) {
            joinSplits[0].nullifierA = uint256(2 * 0x1234);
            joinSplits[0].nullifierB = uint256(2 * 0x1234);
        } else if (
            operationFailure == OperationFailureType.JOINSPLIT_NF_ALREADY_IN_SET
        ) {
            joinSplits[1].nullifierA = joinSplits[0].nullifierA; // Matches last joinsplit's NFs
            joinSplits[1].nullifierA = joinSplits[0].nullifierB;
        }

        uint256 deadline = block.timestamp + DEADLINE_BUFFER;
        if (
            args.operationFailureType == OperationFailureType.EXPIRED_DEADLINE
        ) {
            deadline = 0;
        }

        TrackedAsset[] memory trackedJoinSplitAssets = new TrackedAsset[](
            args.joinSplitsPublicSpends.length
        );
        for (uint256 i = 0; i < args.joinSplitTokens.length; i++) {
            trackedJoinSplitAssets[i] = TrackedAsset({
                encodedAsset: AssetUtils.encodeAsset(
                    AssetType.ERC20,
                    address(args.joinSplitTokens[i]),
                    ERC20_ID
                ),
                minRefundValue: args.joinSplitRefundValues[i]
            });
        }

        Operation memory op = Operation({
            joinSplits: joinSplits,
            refundAddr: defaultStealthAddress(),
            trackedJoinSplitAssets: trackedJoinSplitAssets,
            trackedRefundAssets: args.trackedRefundAssets,
            actions: args.actions,
            encodedGasAsset: AssetUtils.encodeAsset(
                AssetType.ERC20,
                address(args.gasToken),
                ERC20_ID
            ),
            gasAssetRefundThreshold: args.gasAssetRefundThreshold,
            executionGasLimit: args.executionGasLimit,
            gasPrice: args.gasPrice,
            deadline: deadline,
            atomicActions: args.atomicActions
        });

        return op;
    }

    function formatDummyOperationResult(
        Operation memory op
    ) internal pure returns (OperationResult memory result) {
        return
            OperationResult({
                opProcessed: true,
                assetsUnwrapped: true,
                failureReason: "",
                callSuccesses: new bool[](0),
                callResults: new bytes[](0),
                executionGas: op.executionGasLimit,
                verificationGas: op.joinSplits.length *
                    GAS_PER_JOINSPLIT_VERIFY,
                numRefunds: op.trackedJoinSplitAssets.length +
                    op.trackedRefundAssets.length
            });
    }

    function _totalNumJoinSplitsForArgs(
        FormatOperationArgs memory args
    ) internal pure returns (uint256) {
        uint256 totalJoinSplits = 0;
        for (uint256 i = 0; i < args.joinSplitsPublicSpends.length; i++) {
            totalJoinSplits += args.joinSplitsPublicSpends[i].length;
        }

        return totalJoinSplits;
    }

    function _joinSplitTokensArrayOfOneToken(
        address joinSplitToken
    ) internal pure returns (address[] memory) {
        address[] memory joinSplitTokens = new address[](1);
        joinSplitTokens[0] = joinSplitToken;
        return joinSplitTokens;
    }

    function _publicSpendsArrayOfOnePublicSpendArray(
        uint256[] memory publicSpends
    ) internal pure returns (uint256[][] memory) {
        uint256[][] memory publicSpendsArray = new uint256[][](1);
        publicSpendsArray[0] = publicSpends;
        return publicSpendsArray;
    }

    function _dummyEncryptedNote()
        internal
        pure
        returns (EncryptedNote memory)
    {
        bytes memory ciphertextBytes = new bytes(181);
        bytes memory encapsulatedSecretBytes = new bytes(64);

        return
            EncryptedNote({
                ciphertextBytes: ciphertextBytes,
                encapsulatedSecretBytes: encapsulatedSecretBytes
            });
    }
}
