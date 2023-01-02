// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.17;

uint256 constant GAS_PER_VERIFICATION = 200000;
uint256 constant GAS_PER_REFUND_HANDLE = 0;
uint256 constant GAS_PER_REFUND_TREE = 0;

enum AssetType {
    ERC20,
    ERC721,
    ERC1155
}

struct EncodedAsset {
    uint256 encodedAssetAddr;
    uint256 encodedAssetId;
}

struct Signature {
    uint8 v;
    bytes32 r;
    bytes32 s;
}

struct NocturneAddress {
    uint256 h1X;
    uint256 h1Y;
    uint256 h2X;
    uint256 h2Y;
}

struct EncodedNocturneAddress {
    uint256 h1X;
    uint256 h2X;
}

struct NoteTransmission {
    NocturneAddress owner;
    uint256 encappedKey;
    uint256 encryptedNonce;
    uint256 encryptedValue;
}

struct JoinSplitTransaction {
    uint256 commitmentTreeRoot;
    uint256 nullifierA;
    uint256 nullifierB;
    uint256 newNoteACommitment;
    uint256 newNoteBCommitment;
    uint256[8] proof;
    uint256 encodedAssetAddr;
    uint256 encodedAssetId;
    uint256 publicSpend;
    NoteTransmission newNoteATransmission;
    NoteTransmission newNoteBTransmission;
}

struct EncodedNote {
    uint256 ownerH1;
    uint256 ownerH2;
    uint256 nonce;
    uint256 encodedAssetAddr;
    uint256 encodedAssetId;
    uint256 value;
}

struct SubtreeUpdateArgs {
    uint256 oldRoot;
    uint256 newRoot;
    uint256[8] proof;
}

struct WalletBalanceInfo {
    mapping(address => uint256[]) erc721Ids;
    address[] erc721Addresses;
    mapping(address => uint256[]) erc1155Ids;
    address[] erc1155Addresses;
}

struct Bundle {
    Operation[] operations;
}

struct Operation {
    JoinSplitTransaction[] joinSplitTxs;
    NocturneAddress refundAddr;
    EncodedAsset[] encodedRefundAssets;
    Action[] actions;
    uint256 verificationGasLimit;
    uint256 executionGasLimit;
    uint256 maxNumRefunds;
    uint256 gasPrice;
}

// An operation is processed if its joinsplitTxs are processed.
// If an operation is processed, the following is guaranteeed to happen:
// 1. Encoded calls are attempted (not necessarily successfully)
// 2. The bundler is compensated verification and execution gas
// Bundlers should only be submitting operations that can be processed.
struct OperationResult {
    bool opProcessed;
    string failureReason;
    bool[] callSuccesses;
    bytes[] callResults;
    uint256 verificationGas;
    uint256 executionGas;
    uint256 numRefunds;
}

struct Action {
    address contractAddress;
    bytes encodedFunction;
}

struct Deposit {
    address spender;
    uint256 encodedAssetAddr;
    uint256 encodedAssetId;
    uint256 value;
    NocturneAddress depositAddr;
}

library BundleLib {
    function totalNumJoinSplits(
        Bundle calldata self
    ) internal pure returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < self.operations.length; i++) {
            total += self.operations[i].joinSplitTxs.length;
        }
        return total;
    }
}

library OperationLib {
    function gasAsset(
        Operation calldata self
    ) internal pure returns (EncodedAsset memory) {
        return
            EncodedAsset({
                encodedAssetAddr: self.joinSplitTxs[0].encodedAssetAddr,
                encodedAssetId: self.joinSplitTxs[0].encodedAssetId
            });
    }

    function maxGasLimit(
        Operation calldata self
    ) internal pure returns (uint256) {
        return
            self.executionGasLimit +
            (GAS_PER_VERIFICATION * self.joinSplitTxs.length) +
            (GAS_PER_REFUND_HANDLE * self.encodedRefundAssets.length) +
            (GAS_PER_REFUND_TREE * self.encodedRefundAssets.length);
    }

    function maxGasAssetCost(
        Operation calldata self
    ) internal pure returns (uint256) {
        return self.gasPrice * maxGasLimit(self);
    }
}
