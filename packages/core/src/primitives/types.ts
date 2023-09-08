import { CanonAddress, CompressedStealthAddress } from "../crypto";
import { JoinSplitInputs, MerkleProofInput, SolidityProof } from "../proof";
import { IncludedNote, Note } from "./note";
import { Asset, EncodedAsset } from "./asset";
import { SerializedHybridCiphertext } from "@nocturne-xyz/crypto-utils";

export const BN254_SCALAR_FIELD_MODULUS =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const BLOCK_GAS_LIMIT = 30_000_000n;
export const SENDER_COMMITMENT_DOMAIN_SEPARATOR =
  5680996188676417870015190585682285899130949254168256752199352013418366665222n;

export type Address = string;

export type Nullifier = bigint;

export interface Action {
  contractAddress: Address;
  encodedFunction: string;
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

export type EncryptedNote = SerializedHybridCiphertext;

export interface IncludedEncryptedNote extends EncryptedNote {
  merkleIndex: number;
  commitment: bigint;
}

export interface BaseJoinSplit {
  commitmentTreeRoot: bigint;
  nullifierA: bigint;
  nullifierB: bigint;
  newNoteACommitment: bigint;
  newNoteBCommitment: bigint;
  senderCommitment: bigint;
  joinSplitInfoCommitment: bigint;
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
  refundAddr: CompressedStealthAddress;
}

export interface PreProofJoinSplit extends BaseJoinSplit {
  opDigest: bigint;
  proofInputs: JoinSplitInputs;
  refundAddr: CompressedStealthAddress;
}

export interface ProvenJoinSplit extends BaseJoinSplit {
  proof: SolidityProof;
}

export type SignableJoinSplit = Omit<
  BaseJoinSplit,
  "encodedAsset" | "publicSpend"
>;

export interface SignablePublicJoinSplit {
  joinSplit: SignableJoinSplit;
  assetIndex: number;
  publicSpend: bigint;
}

export interface SubmittableJoinSplit extends SignableJoinSplit {
  proof: SolidityProof;
}

export interface SubmittablePublicJoinSplit
  extends Omit<SignablePublicJoinSplit, "joinSplit"> {
  joinSplit: SubmittableJoinSplit;
}

export interface NetworkInfo {
  chainId: bigint;
  tellerContract: Address;
}

export interface TrackedAsset {
  encodedAsset: EncodedAsset;
  minRefundValue: bigint;
}

export interface BaseOperation {
  networkInfo: NetworkInfo;
  refundAddr: CompressedStealthAddress;
  encodedRefundAssets: EncodedAsset[];
  actions: Action[];
  encodedGasAsset: EncodedAsset;
  gasAssetRefundThreshold: bigint;
  executionGasLimit: bigint;
  gasPrice: bigint;
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

export interface SignableOperationWithNetworkInfo
  extends Omit<BaseOperation, "encodedRefundAssets"> {
  pubJoinSplits: SignablePublicJoinSplit[];
  confJoinSplits: SignableJoinSplit[];
  trackedAssets: TrackedAsset[];
}

export interface SubmittableOperationWithNetworkInfo
  extends Omit<SignableOperationWithNetworkInfo, "joinSplits"> {
  pubJoinSplits: SubmittablePublicJoinSplit[];
  confJoinSplits: SubmittableJoinSplit[];
}

export interface Bundle {
  operations: SubmittableOperationWithNetworkInfo[];
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

export interface OperationMetadata {
  items: OperationMetadataItem[];
}

export type OperationMetadataItem =
  | ConfidentialPaymentMetadata
  | ActionMetadata;

export type ActionMetadata =
  | {
      type: "Action";
      actionType: "Transfer";
      recipientAddress: Address;
      erc20Address: Address;
      amount: bigint;
    }
  | {
      type: "Action";
      actionType: "Weth To Wsteth";
      amount: bigint;
    };

export interface ConfidentialPaymentMetadata {
  type: "ConfidentialPayment";
  recipient: CanonAddress;
  asset: Asset;
  amount: bigint;
}

export interface OpDigestWithMetadata {
  opDigest: bigint;
  metadata?: OperationMetadata;
}

export interface OperationWithMetadata<T extends Operation> {
  op: T;
  metadata?: OperationMetadata;
}

export interface CanonAddrRegistryEntry {
  ethAddress: Address;
  compressedCanonAddr: bigint;
  perCanonAddrNonce: bigint;
}
