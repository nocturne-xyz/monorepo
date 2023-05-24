// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.17;

uint256 constant GAS_PER_JOINSPLIT_VERIFY = 100_000;
uint256 constant GAS_PER_JOINSPLIT_HANDLE = 70_000;
uint256 constant GAS_PER_REFUND_TREE = 30_000;
uint256 constant GAS_PER_REFUND_HANDLE = 50_000;

enum AssetType {
    ERC20,
    ERC721,
    ERC1155
}

struct EncodedAsset {
    uint256 encodedAssetAddr;
    uint256 encodedAssetId;
}

struct EncodedAssetWithLastIndex {
    EncodedAsset encodedAsset;
    uint256 lastIndex;
}

struct StealthAddress {
    uint256 h1X;
    uint256 h1Y;
    uint256 h2X;
    uint256 h2Y;
}

struct EncryptedNote {
    StealthAddress owner;
    uint256 encappedKey;
    uint256 encryptedNonce;
    uint256 encryptedValue;
}

struct JoinSplit {
    uint256 commitmentTreeRoot;
    uint256 nullifierA;
    uint256 nullifierB;
    uint256 newNoteACommitment;
    uint256 newNoteBCommitment;
    uint256 encSenderCanonAddrC1X;
    uint256 encSenderCanonAddrC2X;
    uint256[8] proof;
    uint256 publicSpend;
    EncryptedNote newNoteAEncrypted;
    EncryptedNote newNoteBEncrypted;
}

struct JoinSplitEmitted {
    uint256 commitmentTreeRoot;
    uint256 nullifierA;
    uint256 nullifierB;
    uint256 newNoteACommitment;
    uint256 newNoteBCommitment;
    uint256 encSenderCanonAddrC1X;
    uint256 encSenderCanonAddrC2X;
    uint256[8] proof;
    // TODO: event should not naively emit entire struct?
    EncodedAsset encodedAsset; // include encodedAsset
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
    StealthAddress depositAddr;
    uint256 nonce;
    uint256 gasCompensation;
}

struct Deposit {
    address spender;
    EncodedAsset encodedAsset;
    uint256 value;
    StealthAddress depositAddr;
}

struct Action {
    address contractAddress;
    bytes encodedFunction;
}

struct Operation {
    JoinSplit[] joinSplits;
    EncodedAssetWithLastIndex[] encodedAssetsWithLastIndex;
    StealthAddress refundAddr;
    EncodedAsset[] encodedRefundAssets;
    Action[] actions;
    EncodedAsset encodedGasAsset;
    bool hasGasAsset;
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
    function hasValidJoinSplitIndices(
        Operation calldata self
    ) internal pure returns (bool) {
        // disallow operation with no joinsplits
        if (
            self.encodedAssetsWithLastIndex.length == 0 ||
            self.joinSplits.length == 0
        ) {
            return false;
        }

        // last asset last index must equal index of final joinsplit
        if (
            self
                .encodedAssetsWithLastIndex[
                    self.encodedAssetsWithLastIndex.length - 1
                ]
                .lastIndex != self.joinSplits.length - 1
        ) {
            return false;
        }

        uint256 previousLastIndex = self
            .encodedAssetsWithLastIndex[0]
            .lastIndex;
        for (uint256 i = 0; i < self.encodedAssetsWithLastIndex.length; i++) {
            // each index must always be less than or equal to number of joinsplits
            if (
                self.encodedAssetsWithLastIndex[i].lastIndex >
                self.joinSplits.length - 1
            ) {
                return false;
            }

            // indices must be strictly increasing
            if (
                i > 0 &&
                self.encodedAssetsWithLastIndex[i].lastIndex <=
                previousLastIndex
            ) {
                return false;
            }

            previousLastIndex = self.encodedAssetsWithLastIndex[i].lastIndex;
        }

        return true;
    }

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
}
