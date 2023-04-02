import { StealthAddress } from "../crypto";
import { JoinSplitInputs, MerkleProofInput, SolidityProof } from "../proof";
import { IncludedNote, Note } from "./note";
import { Asset, EncodedAsset } from "./asset";

export const SNARK_SCALAR_FIELD =
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
  depositAddr: StealthAddress;
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
  owner: StealthAddress;
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
}

export interface ProvenJoinSplit extends BaseJoinSplit {
  proof: SolidityProof;
}

interface BaseOperation {
  refundAddr: StealthAddress;
  encodedRefundAssets: EncodedAsset[];
  actions: Action[];
  encodedGasAsset: EncodedAsset;
  executionGasLimit: bigint;
  maxNumRefunds: bigint;
  gasPrice: bigint;
  chainId: bigint;
  deadline: bigint;
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

export enum OperationStatus {
  QUEUED = "QUEUED",
  PRE_BATCH = "PRE_BATCH",
  IN_BATCH = "IN_BATCH",
  IN_FLIGHT = "IN_FLIGHT",
  BUNDLE_REVERTED = "BUNDLE_REVERTED",
  EXECUTED_SUCCESS = "EXECUTED_SUCCESS",
  EXECUTED_FAILED = "EXECUTED_FAILED",
}
