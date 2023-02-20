//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

import "../../libs/Types.sol";
import {AssetUtils} from "../../libs/AssetUtils.sol";
import {SimpleERC20Token} from "../tokens/SimpleERC20Token.sol";

struct TransferOperationArgs {
    SimpleERC20Token token;
    uint256 root;
    address recipient;
    uint256 amount;
    uint256 publicSpendPerJoinSplit;
    uint256 numJoinSplits;
    EncodedAsset[] encodedRefundAssets;
    uint256 verificationGasLimit;
    uint256 executionGasLimit;
    uint256 gasPrice;
}

library NocturneUtils {
    uint256 constant ERC20_ID = 0;

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

    function formatDeposit(
        address spender,
        address asset,
        uint256 value,
        uint256 id,
        StealthAddress memory depositAddr
    ) public pure returns (Deposit memory) {
        EncodedAsset memory encodedAsset = AssetUtils.encodeAsset(
            AssetType.ERC20,
            asset,
            id
        );

        return
            Deposit({
                spender: spender,
                encodedAssetAddr: encodedAsset.encodedAssetAddr,
                encodedAssetId: encodedAsset.encodedAssetId,
                value: value,
                depositAddr: depositAddr
            });
    }

    function formatTransferOperation(
        TransferOperationArgs memory args
    ) internal pure returns (Operation memory) {
        Action memory transferAction = Action({
            contractAddress: address(args.token),
            encodedFunction: abi.encodeWithSelector(
                args.token.transfer.selector,
                args.recipient,
                args.amount
            )
        });

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
            address(args.token),
            ERC20_ID
        );

        JoinSplit[] memory joinSplits = new JoinSplit[](args.numJoinSplits);
        for (uint256 i = 0; i < args.numJoinSplits; i++) {
            joinSplits[i] = JoinSplit({
                commitmentTreeRoot: root,
                nullifierA: uint256(2 * i),
                nullifierB: uint256(2 * i + 1),
                newNoteACommitment: uint256(i),
                newNoteAEncrypted: newNoteAEncrypted,
                newNoteBCommitment: uint256(i),
                newNoteBEncrypted: newNoteBEncrypted,
                proof: dummyProof(),
                encodedAsset: encodedAsset,
                publicSpend: args.publicSpendPerJoinSplit
            });
        }

        Action[] memory actions = new Action[](1);
        actions[0] = transferAction;
        Operation memory op = Operation({
            joinSplits: joinSplits,
            refundAddr: defaultStealthAddress(),
            encodedRefundAssets: args.encodedRefundAssets,
            actions: actions,
            verificationGasLimit: args.verificationGasLimit,
            executionGasLimit: args.executionGasLimit,
            gasPrice: args.gasPrice,
            maxNumRefunds: joinSplits.length + args.encodedRefundAssets.length
        });

        return op;
    }

    function formatDummyOperationResult(
        Operation memory op
    ) internal pure returns (OperationResult memory result) {
        return
            OperationResult({
                opProcessed: true,
                failureReason: "",
                callSuccesses: new bool[](0),
                callResults: new bytes[](0),
                executionGas: op.executionGasLimit,
                verificationGas: op.verificationGasLimit,
                numRefunds: op.joinSplits.length + op.encodedRefundAssets.length
            });
    }
}
