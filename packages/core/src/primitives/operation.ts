import { dedup } from "../utils/functional";
import { AssetTrait } from "./asset";
import {
  BN254_SCALAR_FIELD_MODULUS,
  PreSignOperation,
  ProvenOperation,
  SignableJoinSplit,
  SignableOperationWithNetworkInfo,
  SignablePublicJoinSplit,
  SignedOperation,
  SubmittableJoinSplit,
  SubmittableOperationWithNetworkInfo,
  SubmittablePublicJoinSplit,
  TrackedAsset,
} from "./types";
import { ethers, TypedDataDomain } from "ethers";

const { _TypedDataEncoder } = ethers.utils;

const TELLER_CONTRACT_NAME = "NocturneTeller";
const TELLER_CONTRACT_VERSION = "v1";

export const __OPERATION_TYPES = {
  OperationWithoutProofs: [
    { name: "pubJoinSplits", type: "PublicJoinSplitWithoutProof[]" },
    { name: "confJoinSplits", type: "JoinSplitWithoutProof[]" },
    { name: "refundAddr", type: "CompressedStealthAddress" },
    { name: "trackedAssets", type: "TrackedAsset[]" },
    { name: "actions", type: "Action[]" },
    { name: "encodedGasAsset", type: "EncodedAsset" },
    { name: "gasAssetRefundThreshold", type: "uint256" },
    { name: "executionGasLimit", type: "uint256" },
    { name: "gasPrice", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "atomicActions", type: "bool" },
    { name: "isForcedExit", type: "bool" },
  ],
  Action: [
    { name: "contractAddress", type: "address" },
    { name: "encodedFunction", type: "bytes" },
  ],
  CompressedStealthAddress: [
    { name: "h1", type: "uint256" },
    { name: "h2", type: "uint256" },
  ],
  JoinSplitWithoutProof: [
    { name: "commitmentTreeRoot", type: "uint256" },
    { name: "nullifierA", type: "uint256" },
    { name: "nullifierB", type: "uint256" },
    { name: "newNoteACommitment", type: "uint256" },
    { name: "newNoteBCommitment", type: "uint256" },
    { name: "senderCommitment", type: "uint256" },
    { name: "joinSplitInfoCommitment", type: "uint256" },
    { name: "newNoteAEncrypted", type: "EncryptedNote" },
    { name: "newNoteBEncrypted", type: "EncryptedNote" },
  ],
  PublicJoinSplitWithoutProof: [
    { name: "joinSplit", type: "JoinSplitWithoutProof" },
    { name: "assetIndex", type: "uint8" },
    { name: "publicSpend", type: "uint256" },
  ],
  EncodedAsset: [
    { name: "encodedAssetAddr", type: "uint256" },
    { name: "encodedAssetId", type: "uint256" },
  ],
  TrackedAsset: [
    { name: "encodedAsset", type: "EncodedAsset" },
    { name: "minRefundValue", type: "uint256" },
  ],
  EncryptedNote: [
    { name: "ciphertextBytes", type: "bytes" },
    { name: "encapsulatedSecretBytes", type: "bytes" },
  ],
};

export class OperationTrait {
  static computeDigest(operation: PreSignOperation | SignedOperation | ProvenOperation | SignableOperationWithNetworkInfo | SubmittableOperationWithNetworkInfo): bigint {
    return computeOperationDigest(operation);
  }

  static hash(
    operation:
      | PreSignOperation
      | SignedOperation
      | ProvenOperation
      | SignableOperationWithNetworkInfo
  ): string {
    return hashOperation(operation);
  } 

  static toSignableOperation(
    op: PreSignOperation | SignedOperation | ProvenOperation
  ): SignableOperationWithNetworkInfo {
    return toSignableOperation(op);
  }

  static toSubmittableOperation(
    op: ProvenOperation
  ): SubmittableOperationWithNetworkInfo {
    return toSubmittableOperation(op);
  }

  static getTrackedAssets(
    op: PreSignOperation | SignedOperation | ProvenOperation
  ): TrackedAsset[] {
    return getTrackedAssets(op);
  }
}

function computeOperationDigest(
  operation:
    | PreSignOperation
    | SignedOperation
    | ProvenOperation
    | SignableOperationWithNetworkInfo
    | SubmittableOperationWithNetworkInfo
): bigint {
  if (!("trackedAssets" in operation)) {
    operation = toSignableOperation(operation);
  }

  const domain: TypedDataDomain = {
    name: TELLER_CONTRACT_NAME,
    version: TELLER_CONTRACT_VERSION,
    chainId: operation.networkInfo.chainId,
    verifyingContract: operation.networkInfo.tellerContract,
  };

  const digest = _TypedDataEncoder.hash(domain, __OPERATION_TYPES, operation);
  return BigInt(digest) % BN254_SCALAR_FIELD_MODULUS;
}

function hashOperation(
  operation:
    | PreSignOperation
    | SignedOperation
    | ProvenOperation
    | SignableOperationWithNetworkInfo
): string {
  if (!("trackedAssets" in operation)) {
    operation = toSignableOperation(operation);
  }

  return _TypedDataEncoder.hashStruct(
    "OperationWithoutProofs",
    __OPERATION_TYPES,
    operation
  );
}

// TODO: eventually remove translation layer and build in correct op structure into sdk
function toSignableOperation(
  op: PreSignOperation | SignedOperation | ProvenOperation
): SignableOperationWithNetworkInfo {
  const {
    networkInfo,
    joinSplits,
    refundAddr,
    actions,
    encodedGasAsset,
    gasAssetRefundThreshold,
    executionGasLimit,
    gasPrice,
    deadline,
    atomicActions,
    isForcedExit,
  } = op;

  const trackedAssets = getTrackedAssets(op);

  const pubJoinSplits: SignablePublicJoinSplit[] = [];
  const confJoinSplits: SignableJoinSplit[] = [];
  for (const js of joinSplits) {
    if (js.publicSpend > 0n) {
      const assetIndex = trackedAssets.findIndex((tracked) =>
        AssetTrait.isSameEncodedAsset(tracked.encodedAsset, js.encodedAsset)
      );
      pubJoinSplits.push({
        joinSplit: {
          commitmentTreeRoot: js.commitmentTreeRoot,
          nullifierA: js.nullifierA,
          nullifierB: js.nullifierB,
          newNoteACommitment: js.newNoteACommitment,
          newNoteBCommitment: js.newNoteBCommitment,
          senderCommitment: js.senderCommitment,
          joinSplitInfoCommitment: js.joinSplitInfoCommitment,
          newNoteAEncrypted: js.newNoteAEncrypted,
          newNoteBEncrypted: js.newNoteBEncrypted,
        },
        assetIndex,
        publicSpend: js.publicSpend,
      });
    } else {
      confJoinSplits.push({
        commitmentTreeRoot: js.commitmentTreeRoot,
        nullifierA: js.nullifierA,
        nullifierB: js.nullifierB,
        newNoteACommitment: js.newNoteACommitment,
        newNoteBCommitment: js.newNoteBCommitment,
        senderCommitment: js.senderCommitment,
        joinSplitInfoCommitment: js.joinSplitInfoCommitment,
        newNoteAEncrypted: js.newNoteAEncrypted,
        newNoteBEncrypted: js.newNoteBEncrypted,
      });
    }
  }

  return {
    networkInfo,
    pubJoinSplits,
    confJoinSplits,
    refundAddr,
    trackedAssets,
    actions,
    encodedGasAsset,
    gasAssetRefundThreshold,
    executionGasLimit,
    gasPrice,
    deadline,
    atomicActions,
    isForcedExit,
  };
}

function toSubmittableOperation(
  op: ProvenOperation
): SubmittableOperationWithNetworkInfo {
  const {
    networkInfo,
    joinSplits,
    refundAddr,
    actions,
    encodedGasAsset,
    gasAssetRefundThreshold,
    executionGasLimit,
    gasPrice,
    deadline,
    atomicActions,
    isForcedExit,
  } = op;

  const trackedAssets = getTrackedAssets(op);

  const pubJoinSplits: SubmittablePublicJoinSplit[] = [];
  const confJoinSplits: SubmittableJoinSplit[] = [];
  for (const js of joinSplits) {
    if (js.publicSpend > 0n) {
      const assetIndex = trackedAssets.findIndex((tracked) =>
        AssetTrait.isSameEncodedAsset(tracked.encodedAsset, js.encodedAsset)
      );
      pubJoinSplits.push({
        joinSplit: {
          commitmentTreeRoot: js.commitmentTreeRoot,
          nullifierA: js.nullifierA,
          nullifierB: js.nullifierB,
          proof: js.proof,
          newNoteACommitment: js.newNoteACommitment,
          newNoteBCommitment: js.newNoteBCommitment,
          senderCommitment: js.senderCommitment,
          joinSplitInfoCommitment: js.joinSplitInfoCommitment,
          newNoteAEncrypted: js.newNoteAEncrypted,
          newNoteBEncrypted: js.newNoteBEncrypted,
        },
        assetIndex,
        publicSpend: js.publicSpend,
      });
    } else {
      confJoinSplits.push({
        commitmentTreeRoot: js.commitmentTreeRoot,
        nullifierA: js.nullifierA,
        nullifierB: js.nullifierB,
        proof: js.proof,
        newNoteACommitment: js.newNoteACommitment,
        newNoteBCommitment: js.newNoteBCommitment,
        senderCommitment: js.senderCommitment,
        joinSplitInfoCommitment: js.joinSplitInfoCommitment,
        newNoteAEncrypted: js.newNoteAEncrypted,
        newNoteBEncrypted: js.newNoteBEncrypted,
      });
    }
  }

  return {
    networkInfo,
    pubJoinSplits,
    confJoinSplits,
    refundAddr,
    trackedAssets,
    actions,
    encodedGasAsset,
    gasAssetRefundThreshold,
    executionGasLimit,
    gasPrice,
    deadline,
    atomicActions,
    isForcedExit,
  };
}

function getTrackedAssets(
  op: PreSignOperation | SignedOperation | ProvenOperation
): TrackedAsset[] {
  const { joinSplits, refunds } = op;
  const assets: TrackedAsset[] = [
    ...joinSplits.map(({ encodedAsset }) => ({
      encodedAsset,
      minRefundValue: 0n, // NOTE: this should be OK so long as users don't unwrap more tokens than they intend to spend, this is why we do not expose unwraps directly to end consumers, only plugins fns which ensure just the minimum amount is unwrapped
    })),
    ...refunds.map(({ encodedAsset, minRefundValue }) => ({
      encodedAsset,
      minRefundValue,
    })),
  ];

  // dedup assets and sort
  return dedup(assets).sort();
}
