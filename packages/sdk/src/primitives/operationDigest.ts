import {
  BN254_SCALAR_FIELD_MODULUS,
  BasicOperation,
  OnchainOperation,
  PreSignOperation,
  ProvenOperation,
  SignedOperation,
} from "./types";
import { ethers, TypedDataDomain } from "ethers";
const { _TypedDataEncoder } = ethers.utils;

export const TELLER_CONTRACT_NAME = "NocturneTeller";
export const TELLER_CONTRACT_VERSION = "v1";

export const OPERATION_TYPES = {
  OperationWithoutProofs: [
    { name: "joinSplits", type: "JoinSplitWithoutProof[]" },
    { name: "refundAddr", type: "CompressedStealthAddress" },
    { name: "encodedRefundAssets", type: "EncodedAsset[]" },
    { name: "actions", type: "Action[]" },
    { name: "encodedGasAsset", type: "EncodedAsset" },
    { name: "gasAssetRefundThreshold", type: "uint256" },
    { name: "executionGasLimit", type: "uint256" },
    { name: "maxNumRefunds", type: "uint256" },
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
    { name: "encodedAsset", type: "EncodedAsset" },
    { name: "publicSpend", type: "uint256" },
    { name: "newNoteAEncrypted", type: "EncryptedNote" },
    { name: "newNoteBEncrypted", type: "EncryptedNote" },
  ],
  EncodedAsset: [
    { name: "encodedAssetAddr", type: "uint256" },
    { name: "encodedAssetId", type: "uint256" },
  ],
  EncryptedNote: [
    { name: "ciphertextBytes", type: "bytes" },
    { name: "encapsulatedSecretBytes", type: "bytes" },
  ],
};

export function computeOperationDigest(
  operation:
    | BasicOperation
    | PreSignOperation
    | SignedOperation
    | ProvenOperation
): bigint {
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
    | BasicOperation
    | PreSignOperation
    | SignedOperation
    | ProvenOperation
): string {
  return _TypedDataEncoder.hashStruct(
    "OperationWithoutProofs",
    OPERATION_TYPES,
    operation
  );
}

export function toSubmittableOperation(
  provenOp: ProvenOperation
): OnchainOperation {
  return {
    ...provenOp,
  };
}
