import {
  CanonAddress,
  CompressedStealthAddress,
  EncryptedCanonAddress,
} from "../crypto";
import { CompressedPoint } from "../crypto/pointCompression";
import { JoinSplitInputs, MerkleProofInput, SolidityProof } from "../proof";
import { Asset, EncodedAsset } from "./asset";
import { IncludedNote, Note } from "./note";

export const BN254_SCALAR_FIELD_MODULUS =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const BLOCK_GAS_LIMIT = 30_000_000n;

export type Address = string;

export type Nullifier = bigint;

export interface Action {
  contractAddress: Address;
  encodedFunction: string;
}

export interface Bundle {
  operations: ProvenOperation[];
}

export interface Deposit {
  spender: Address;
  asset: Address;
  value: bigint;
  id: bigint;
  depositAddr: CompressedStealthAddress;
}

export interface OperationResult {
  opProcessed: boolean;
  failureReason: string;
  callSuccesses: boolean[];
  callResults: string[];
  verificationGas: bigint;
  executionGas: bigint;
  numRefunds: bigint;
}

export interface EncryptedNote {
  owner: CompressedStealthAddress;
  encappedKey: bigint;
  encryptedNonce: bigint;
  encryptedValue: bigint;
}

export interface IncludedEncryptedNote extends EncryptedNote {
  merkleIndex: number;
  asset: Asset;
  commitment: bigint;
}

export interface BaseJoinSplit {
  commitmentTreeRoot: bigint;
  nullifierA: bigint;
  nullifierB: bigint;
  newNoteACommitment: bigint;
  newNoteBCommitment: bigint;
  encodedAsset: EncodedAsset;
  publicSpend: bigint;
  newNoteAEncrypted: EncryptedNote;
  newNoteBEncrypted: EncryptedNote;
}

export interface PreSignJoinSplit extends BaseJoinSplit {
  receiver: CanonAddress;
  oldNoteA: IncludedNote;
  oldNoteB: IncludedNote;
  newNoteA: Note;
  newNoteB: Note;
  merkleProofA: MerkleProofInput;
  merkleProofB: MerkleProofInput;
}

export interface PreProofJoinSplit extends BaseJoinSplit {
  opDigest: bigint;
  proofInputs: JoinSplitInputs;
  encSenderCanonAddr: EncryptedCanonAddress;
}

export interface ProvenJoinSplit extends BaseJoinSplit {
  proof: SolidityProof;
  encSenderCanonAddrC1: CompressedPoint;
  encSenderCanonAddrC2: CompressedPoint;
}

interface BaseOperation {
  refundAddr: CompressedStealthAddress;
  encodedRefundAssets: EncodedAsset[];
  actions: Action[];
  encodedGasAsset: EncodedAsset;
  gasAssetRefundThreshold: bigint;
  executionGasLimit: bigint;
  maxNumRefunds: bigint;
  gasPrice: bigint;
  chainId: bigint;
  deadline: bigint;
  atomicActions: boolean;
}

export interface PreSignOperation extends BaseOperation {
  joinSplits: PreSignJoinSplit[];
}

export interface SignedOperation extends BaseOperation {
  joinSplits: PreProofJoinSplit[];
}

export interface ProvenOperation extends BaseOperation {
  joinSplits: ProvenJoinSplit[];
}

export type Operation = PreSignOperation | SignedOperation | ProvenOperation;

export interface DepositRequest {
  spender: string;
  encodedAsset: EncodedAsset;
  value: bigint;
  depositAddr: CompressedStealthAddress;
  nonce: bigint;
  gasCompensation: bigint;
}

export enum OperationStatus {
  QUEUED = "QUEUED",
  PRE_BATCH = "PRE_BATCH",
  IN_BATCH = "IN_BATCH",
  IN_FLIGHT = "IN_FLIGHT",
  EXECUTED_SUCCESS = "EXECUTED_SUCCESS",
  OPERATION_PROCESSING_FAILED = "OPERATION_PROCESSING_FAILED",
  OPERATION_EXECUTION_FAILED = "OPERATION_EXECUTION_FAILED",
  BUNDLE_REVERTED = "BUNDLE_REVERTED",
}

export enum DepositRequestStatus {
  DoesNotExist = "DoesNotExist",
  FailedScreen = "FailedScreen",
  PassedFirstScreen = "PassedFirstScreen",
  AwaitingFulfillment = "AwaitingFulfillment",
  Completed = "Completed",
}

export interface WithTimestamp<T> {
  inner: T;
  timestampUnixMillis: number;
}

export interface OptimisticNFRecord {
  nullifier: bigint;
}

export interface OptimisticOpDigestRecord {
  merkleIndices: number[];
  expirationDate: number;
  metadata?: OperationMetadata;
}

export type ActionMetadata = {
  type: "Transfer";
  recipientAddress: Address;
  erc20Address: Address;
  amount: bigint;
};

export interface OperationMetadata {
  action: ActionMetadata;
}

export interface OpDigestWithMetadata {
  opDigest: bigint;
  metadata?: OperationMetadata;
}
