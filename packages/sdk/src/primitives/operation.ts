import {
  BN254_SCALAR_FIELD_MODULUS,
  PreSignOperation,
  ProvenOperation,
  SignableJoinSplit,
  SignableOperationWithNetworkInfo,
  SignedOperation,
  SubmittableJoinSplit,
  SubmittableOperationWithNetworkInfo,
  TrackedAsset,
} from "./types";
import { ethers, TypedDataDomain } from "ethers";
const { _TypedDataEncoder } = ethers.utils;

export const TELLER_CONTRACT_NAME = "NocturneTeller";
export const TELLER_CONTRACT_VERSION = "v1";

export const OPERATION_TYPES = {
  OperationWithoutProofs: [
    { name: "joinSplits", type: "JoinSplitWithoutProof[]" },
    { name: "refundAddr", type: "CompressedStealthAddress" },
    { name: "trackedJoinSplitAssets", type: "TrackedAsset[]" },
    { name: "trackedRefundAssets", type: "TrackedAsset[]" },
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
    { name: "assetIndex", type: "uint8" },
    { name: "publicSpend", type: "uint256" },
    { name: "newNoteAEncrypted", type: "EncryptedNote" },
    { name: "newNoteBEncrypted", type: "EncryptedNote" },
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
  if (!("trackedJoinSplitAssets" in operation)) {
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
  if (!("trackedJoinSplitAssets" in operation)) {
    operation = toSignableOperation(operation);
  }

  return _TypedDataEncoder.hashStruct(
    "OperationWithoutProofs",
    OPERATION_TYPES,
    operation
  );
}

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

  const trackedJoinSplitAssets: Array<TrackedAsset> = Array.from(
    new Set(
      joinSplits.map(({ encodedAsset }) => {
        return { encodedAsset, minRefundValue: 0n };
      })
    )
  );

  const trackedRefundAssets: Array<TrackedAsset> = Array.from(
    new Set(
      encodedRefundAssets.map((encodedAsset) => {
        return { encodedAsset, minRefundValue: 0n };
      })
    )
  );

  const reformattedJoinSplits: SignableJoinSplit[] = joinSplits.map((js) => {
    const assetIndex = trackedJoinSplitAssets.findIndex(
      (a) => a.encodedAsset == js.encodedAsset
    );
    return {
      commitmentTreeRoot: js.commitmentTreeRoot,
      nullifierA: js.nullifierA,
      nullifierB: js.nullifierB,
      newNoteACommitment: js.newNoteACommitment,
      newNoteBCommitment: js.newNoteBCommitment,
      senderCommitment: js.senderCommitment,
      assetIndex,
      publicSpend: js.publicSpend,
      newNoteAEncrypted: js.newNoteAEncrypted,
      newNoteBEncrypted: js.newNoteBEncrypted,
    };
  });

  return {
    networkInfo,
    joinSplits: reformattedJoinSplits,
    refundAddr,
    trackedJoinSplitAssets,
    trackedRefundAssets,
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

  const trackedJoinSplitAssets: Array<TrackedAsset> = Array.from(
    new Set(
      joinSplits.map(({ encodedAsset }) => {
        return { encodedAsset, minRefundValue: 0n };
      })
    )
  );

  const trackedRefundAssets: Array<TrackedAsset> = Array.from(
    new Set(
      encodedRefundAssets.map((encodedAsset) => {
        return { encodedAsset, minRefundValue: 0n };
      })
    )
  );

  const reformattedJoinSplits: SubmittableJoinSplit[] = joinSplits.map((js) => {
    const assetIndex = trackedJoinSplitAssets.findIndex(
      (a) => a.encodedAsset == js.encodedAsset
    );
    return {
      commitmentTreeRoot: js.commitmentTreeRoot,
      nullifierA: js.nullifierA,
      nullifierB: js.nullifierB,
      newNoteACommitment: js.newNoteACommitment,
      newNoteBCommitment: js.newNoteBCommitment,
      senderCommitment: js.senderCommitment,
      assetIndex,
      publicSpend: js.publicSpend,
      newNoteAEncrypted: js.newNoteAEncrypted,
      newNoteBEncrypted: js.newNoteBEncrypted,
      proof: js.proof,
    };
  });

  return {
    networkInfo,
    joinSplits: reformattedJoinSplits,
    refundAddr,
    trackedJoinSplitAssets,
    trackedRefundAssets,
    actions,
    encodedGasAsset,
    gasAssetRefundThreshold,
    executionGasLimit,
    gasPrice,
    deadline,
    atomicActions,
  };
}
