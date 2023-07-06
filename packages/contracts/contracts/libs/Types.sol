// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.17;

uint256 constant GAS_PER_JOINSPLIT_HANDLE = 80_000; // Typically 60k per handle excluding calldata/event costs (+20k buffer)
uint256 constant GAS_PER_REFUND_TREE = 30_000; // Full 16 leaf non-zero subtree update = 320k / 16 = 20k per insertion (+10k buffer)
uint256 constant GAS_PER_REFUND_HANDLE = 40_000;

enum AssetType {
    ERC20,
    ERC721,
    ERC1155
}

struct EncodedAsset {
    uint256 encodedAssetAddr;
    uint256 encodedAssetId;
}

struct CompressedStealthAddress {
    uint256 h1;
    uint256 h2;
}

struct EncryptedNote {
    bytes ciphertextBytes;
    bytes encapsulatedSecretBytes;
}

struct JoinSplit {
    uint256 commitmentTreeRoot;
    uint256 nullifierA;
    uint256 nullifierB;
    uint256 newNoteACommitment;
    uint256 newNoteBCommitment;
    uint256 senderCommitment;
    uint256[8] proof;
    EncodedAsset encodedAsset;
    uint256 publicSpend;
    EncryptedNote newNoteAEncrypted;
    EncryptedNote newNoteBEncrypted;
}

struct EIP712JoinSplit {
    uint256 commitmentTreeRoot;
    uint256 nullifierA;
    uint256 nullifierB;
    uint256 newNoteACommitment;
    uint256 newNoteBCommitment;
    uint256 encSenderCanonAddrC1;
    uint256 encSenderCanonAddrC2;
    uint256[8] proof;
    uint256 publicSpend;
    EncryptedNote newNoteAEncrypted;
    EncryptedNote newNoteBEncrypted;
}

struct EncodedNote {
    uint256 ownerH1;
    uint256 ownerH2;
    uint256 nonce;
    uint256 encodedAssetAddr;
    uint256 encodedAssetId;
    uint256 value;
}

struct DepositRequest {
    address spender;
    EncodedAsset encodedAsset;
    uint256 value;
    CompressedStealthAddress depositAddr;
    uint256 nonce;
    uint256 gasCompensation;
}

struct Deposit {
    address spender;
    EncodedAsset encodedAsset;
    uint256 value;
    CompressedStealthAddress depositAddr;
}

struct Action {
    address contractAddress;
    bytes encodedFunction;
}

struct Operation {
    JoinSplit[] joinSplits;
    CompressedStealthAddress refundAddr;
    EncodedAsset[] encodedRefundAssets;
    Action[] actions;
    EncodedAsset encodedGasAsset;
    uint256 gasAssetRefundThreshold;
    uint256 executionGasLimit;
    uint256 maxNumRefunds;
    uint256 gasPrice;
    uint256 chainId;
    uint256 deadline;
    bool atomicActions;
}

// An operation is processed if its joinsplitTxs are processed.
// If an operation is processed, the following is guaranteeed to happen:
// 1. Encoded calls are attempted (not necessarily successfully)
// 2. The bundler is compensated verification and execution gas
// Bundlers should only be submitting operations that can be processed.
struct OperationResult {
    bool opProcessed;
    bool assetsUnwrapped;
    string failureReason;
    bool[] callSuccesses;
    bytes[] callResults;
    uint256 verificationGas;
    uint256 executionGas;
    uint256 numRefunds;
}

struct Bundle {
    Operation[] operations;
}

library OperationLib {
    function maxGasLimit(
        Operation calldata self,
        uint256 perJoinSplitVerifyGas
    ) internal pure returns (uint256) {
        return
            self.executionGasLimit +
            ((perJoinSplitVerifyGas + GAS_PER_JOINSPLIT_HANDLE) *
                self.joinSplits.length) +
            ((GAS_PER_REFUND_TREE + GAS_PER_REFUND_HANDLE) *
                self.maxNumRefunds);
    }

    function maxGasAssetCost(
        Operation calldata self,
        uint256 perJoinSplitVerifyGas
    ) internal pure returns (uint256) {
        return self.gasPrice * maxGasLimit(self, perJoinSplitVerifyGas);
    }

    function totalNumRefundsToHandle(
        Operation calldata self
    ) internal pure returns (uint256) {
        return self.joinSplits.length + self.encodedRefundAssets.length;
    }
}
