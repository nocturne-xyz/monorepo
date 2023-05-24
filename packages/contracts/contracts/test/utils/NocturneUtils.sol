//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

import "../../libs/Types.sol";
import {AssetUtils} from "../../libs/AssetUtils.sol";
import {SimpleERC20Token} from "../tokens/SimpleERC20Token.sol";

enum OperationFailureType {
    NONE,
    JOINSPLIT_BAD_ROOT,
    JOINSPLIT_NF_ALREADY_IN_SET,
    JOINSPLIT_NFS_SAME,
    BAD_CHAIN_ID,
    EXPIRED_DEADLINE
}

struct FormatOperationArgs {
    SimpleERC20Token joinSplitToken;
    SimpleERC20Token gasToken;
    uint256 root;
    uint256[] joinSplitPublicSpends;
    EncodedAsset[] encodedRefundAssets;
    uint256 executionGasLimit;
    uint256 maxNumRefunds;
    uint256 gasPrice;
    Action[] actions;
    bool atomicActions;
    OperationFailureType operationFailureType;
}

struct TransferRequest {
    SimpleERC20Token token;
    address recipient;
    uint256 amount;
}

library NocturneUtils {
    uint256 constant ERC20_ID = 0;
    uint256 constant DEADLINE_BUFFER = 1000;

    function defaultStealthAddress()
        internal
        pure
        returns (StealthAddress memory)
    {
        return
            StealthAddress({
                h1X: 1938477,
                h1Y: 9104058,
                h2X: 1032988,
                h2Y: 1032988
            });
    }

    function dummyProof() internal pure returns (uint256[8] memory _values) {
        for (uint256 i = 0; i < 8; i++) {
            _values[i] = uint256(4757829);
        }
    }

    function dummyJoinSplit() internal pure returns (JoinSplit memory) {
        return
            JoinSplit({
                commitmentTreeRoot: 0,
                nullifierA: 0,
                nullifierB: 0,
                newNoteACommitment: uint256(0),
                newNoteAEncrypted: EncryptedNote({
                    owner: StealthAddress({
                        h1X: uint256(123),
                        h1Y: uint256(123),
                        h2X: uint256(123),
                        h2Y: uint256(123)
                    }),
                    encappedKey: uint256(111),
                    encryptedNonce: uint256(111),
                    encryptedValue: uint256(111)
                }),
                newNoteBCommitment: uint256(0),
                newNoteBEncrypted: EncryptedNote({
                    owner: StealthAddress({
                        h1X: uint256(123),
                        h1Y: uint256(123),
                        h2X: uint256(123),
                        h2Y: uint256(123)
                    }),
                    encappedKey: uint256(111),
                    encryptedNonce: uint256(111),
                    encryptedValue: uint256(111)
                }),
                proof: NocturneUtils.dummyProof(),
                publicSpend: 0,
                encSenderCanonAddrC1X: 0,
                encSenderCanonAddrC2X: 0
            });
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
        StealthAddress memory depositAddr,
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
        StealthAddress memory depositAddr
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
        SimpleERC20Token token,
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
                    transferRequest.token.transfer.selector,
                    transferRequest.recipient,
                    transferRequest.amount
                )
            });
    }

    function formatOperation(
        FormatOperationArgs memory args
    ) internal view returns (Operation memory) {
        OperationFailureType operationFailure = args.operationFailureType;
        if (operationFailure == OperationFailureType.JOINSPLIT_BAD_ROOT) {
            args.root = 0x12345; // fill with garbage root
        } else if (
            operationFailure == OperationFailureType.JOINSPLIT_NF_ALREADY_IN_SET
        ) {
            require(
                args.joinSplitPublicSpends.length >= 2,
                "Must specify at least 2 joinsplits for JOINSPLIT_NF_ALREADY_IN_SET failure type"
            );
        }

        uint256 root = args.root;
        EncryptedNote memory newNoteAEncrypted = EncryptedNote({
            owner: StealthAddress({
                h1X: uint256(123),
                h1Y: uint256(123),
                h2X: uint256(123),
                h2Y: uint256(123)
            }),
            encappedKey: uint256(111),
            encryptedNonce: uint256(111),
            encryptedValue: uint256(111)
        });
        EncryptedNote memory newNoteBEncrypted = EncryptedNote({
            owner: StealthAddress({
                h1X: uint256(123),
                h1Y: uint256(123),
                h2X: uint256(123),
                h2Y: uint256(123)
            }),
            encappedKey: uint256(111),
            encryptedNonce: uint256(111),
            encryptedValue: uint256(111)
        });

        EncodedAsset memory encodedAsset = AssetUtils.encodeAsset(
            AssetType.ERC20,
            address(args.joinSplitToken),
            ERC20_ID
        );

        // Setup joinsplits depending on failure type
        JoinSplit[] memory joinSplits = new JoinSplit[](
            args.joinSplitPublicSpends.length
        );
        for (uint256 i = 0; i < args.joinSplitPublicSpends.length; i++) {
            uint256 nullifierA = 0;
            uint256 nullifierB = 0;
            if (operationFailure == OperationFailureType.JOINSPLIT_NFS_SAME) {
                nullifierA = uint256(2 * 0x1234);
                nullifierB = uint256(2 * 0x1234);
            } else if (
                operationFailure ==
                OperationFailureType.JOINSPLIT_NF_ALREADY_IN_SET &&
                i + 2 == args.joinSplitPublicSpends.length
            ) {
                nullifierA = uint256(2 * 0x1234); // Matches last NF B
                nullifierB = uint256(2 * i + 1);
            } else if (
                operationFailure ==
                OperationFailureType.JOINSPLIT_NF_ALREADY_IN_SET &&
                i + 1 == args.joinSplitPublicSpends.length
            ) {
                nullifierA = uint256(2 * i);
                nullifierB = uint256(2 * 0x1234); // Matches 2nd to last NF A
            } else {
                nullifierA = uint256(2 * i);
                nullifierB = uint256(2 * i + 1);
            }
            joinSplits[i] = JoinSplit({
                commitmentTreeRoot: root,
                nullifierA: nullifierA,
                nullifierB: nullifierB,
                newNoteACommitment: uint256(i),
                newNoteAEncrypted: newNoteAEncrypted,
                newNoteBCommitment: uint256(i),
                newNoteBEncrypted: newNoteBEncrypted,
                proof: dummyProof(),
                publicSpend: args.joinSplitPublicSpends[i],
                encSenderCanonAddrC1X: 0,
                encSenderCanonAddrC2X: 0
            });
        }

        uint256 chainId = block.chainid;
        if (args.operationFailureType == OperationFailureType.BAD_CHAIN_ID) {
            chainId = block.chainid + 1;
        }

        uint256 deadline = block.timestamp + DEADLINE_BUFFER;
        if (
            args.operationFailureType == OperationFailureType.EXPIRED_DEADLINE
        ) {
            deadline = 0;
        }

        EncodedAssetWithLastIndex[]
            memory encodedAssetsWithLastIndex = new EncodedAssetWithLastIndex[](
                1
            );
        encodedAssetsWithLastIndex[0] = EncodedAssetWithLastIndex({
            encodedAsset: encodedAsset,
            lastIndex: joinSplits.length - 1
        });

        Operation memory op = Operation({
            joinSplits: joinSplits,
            encodedAssetsWithLastIndex: encodedAssetsWithLastIndex,
            refundAddr: defaultStealthAddress(),
            encodedRefundAssets: args.encodedRefundAssets,
            actions: args.actions,
            encodedGasAsset: AssetUtils.encodeAsset(
                AssetType.ERC20,
                address(args.gasToken),
                ERC20_ID
            ),
            executionGasLimit: args.executionGasLimit,
            gasPrice: args.gasPrice,
            maxNumRefunds: args.maxNumRefunds,
            chainId: chainId,
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
                numRefunds: op.joinSplits.length + op.encodedRefundAssets.length
            });
    }
}
