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
import * as JSON from "bigint-json-serialization";

const { _TypedDataEncoder } = ethers.utils;

export const TELLER_CONTRACT_NAME = "NocturneTeller";
export const TELLER_CONTRACT_VERSION = "v1";

export const OPERATION_TYPES = {
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

export function computeOperationDigest(
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

  const digest = _TypedDataEncoder.hash(domain, OPERATION_TYPES, operation);
  return BigInt(digest) % BN254_SCALAR_FIELD_MODULUS;
}

export function hashOperation(
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
    OPERATION_TYPES,
    operation
  );
}

// TODO: eventually remove translation layer and build in correct op structure into sdk
export function toSignableOperation(
  op: PreSignOperation | SignedOperation | ProvenOperation
): SignableOperationWithNetworkInfo {
  const {
    networkInfo,
    joinSplits,
    refundAddr,
    encodedRefundAssets,
    actions,
    encodedGasAsset,
    gasAssetRefundThreshold,
    executionGasLimit,
    gasPrice,
    deadline,
    atomicActions,
  } = op;

  const joinSplitAssets = dedup(
    joinSplits.map(({ encodedAsset }) => encodedAsset)
  );
  // we need to stringify because object refs are not equal, so they won't be deduped
  // we need to sort because the order of the elements of the set
  // is non-deterministic
  const trackedJoinSplitAssets: Array<TrackedAsset> = Array.from(
    joinSplitAssets.map((encodedAsset) => {
      return JSON.stringify({ encodedAsset, minRefundValue: 0n });
    })
  )
    .sort()
    .map(JSON.parse);

  const refundAssets = dedup(encodedRefundAssets);
  const trackedRefundAssets: Array<TrackedAsset> = Array.from(
    refundAssets.map((encodedAsset) => {
      return JSON.stringify({ encodedAsset, minRefundValue: 0n });
    })
  )
    .sort()
    .map(JSON.parse);

  const trackedAssets = trackedJoinSplitAssets.concat(trackedRefundAssets);

  const pubJoinSplits: SignablePublicJoinSplit[] = [];
  const confJoinSplits: SignableJoinSplit[] = [];
  for (const js of joinSplits) {
    if (js.publicSpend > 0n) {
      const assetIndex = trackedJoinSplitAssets.findIndex((a) =>
        AssetTrait.isSameEncodedAsset(a.encodedAsset, js.encodedAsset)
      );
      pubJoinSplits.push({
        joinSplit: {
          commitmentTreeRoot: js.commitmentTreeRoot,
          nullifierA: js.nullifierA,
          nullifierB: js.nullifierB,
          newNoteACommitment: js.newNoteACommitment,
          newNoteBCommitment: js.newNoteBCommitment,
          senderCommitment: js.senderCommitment,
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
  };
}

export function toSubmittableOperation(
  op: ProvenOperation
): SubmittableOperationWithNetworkInfo {
  const {
    networkInfo,
    joinSplits,
    refundAddr,
    encodedRefundAssets,
    actions,
    encodedGasAsset,
    gasAssetRefundThreshold,
    executionGasLimit,
    gasPrice,
    deadline,
    atomicActions,
  } = op;

  // we need to stringify because object refs are not equal, so they won't be deduped
  // we need to sort because the order of the elements of the set
  // is non-deterministic
  const trackedJoinSplitAssets: Array<TrackedAsset> = Array.from(
    new Set(
      joinSplits.map(({ encodedAsset }) => {
        return JSON.stringify({ encodedAsset, minRefundValue: 0n });
      })
    )
  )
    .sort()
    .map(JSON.parse);

  const trackedRefundAssets: Array<TrackedAsset> = Array.from(
    new Set(
      encodedRefundAssets.map((encodedAsset) => {
        return JSON.stringify({ encodedAsset, minRefundValue: 0n });
      })
    )
  )
    .sort()
    .map(JSON.parse);

  const trackedAssets = trackedJoinSplitAssets.concat(trackedRefundAssets);

  const pubJoinSplits: SubmittablePublicJoinSplit[] = [];
  const confJoinSplits: SubmittableJoinSplit[] = [];
  for (const js of joinSplits) {
    if (js.publicSpend > 0n) {
      const assetIndex = trackedJoinSplitAssets.findIndex((a) =>
        AssetTrait.isSameEncodedAsset(a.encodedAsset, js.encodedAsset)
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
  };
}
