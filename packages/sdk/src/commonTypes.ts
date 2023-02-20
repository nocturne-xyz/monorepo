import { Action } from "./contract";
import { StealthAddress } from "./crypto";
import { JoinSplitInputs, MerkleProofInput, SolidityProof } from "./proof";
import { IncludedNote, Note } from "./note";
import { EncodedAsset } from "./asset";

export const SNARK_SCALAR_FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const BLOCK_GAS_LIMIT = 30_000_000n;

export type Address = string;
export type NoteAssetKey = string; // Takes form of NOTES_<address>_<id>
export type AllNotes = Map<NoteAssetKey, IncludedNote[]>;

export interface EncryptedNote {
  owner: StealthAddress;
  encappedKey: bigint;
  encryptedNonce: bigint;
  encryptedValue: bigint;
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

export interface PreProofJoinSplit extends BaseJoinSplit {
  oldNoteA: IncludedNote;
  oldNoteB: IncludedNote;
  newNoteA: Note;
  newNoteB: Note;
  merkleProofA: MerkleProofInput;
  merkleProofB: MerkleProofInput;
}

export interface SignedJoinSplit extends BaseJoinSplit {
  opDigest: bigint;
  proofInputs: JoinSplitInputs;
}

export interface ProvenJoinSplit extends BaseJoinSplit {
  proof: SolidityProof;
}

export interface BaseOperation {
  refundAddr: StealthAddress;
  encodedRefundAssets: EncodedAsset[];
  actions: Action[];
  executionGasLimit: bigint;
  maxNumRefunds: bigint;
  gasPrice: bigint;
}

export interface PreSignOperation extends BaseOperation {
  joinSplits: PreProofJoinSplit[];
}

export interface SignedOperation extends BaseOperation {
  joinSplits: SignedJoinSplit[];
}

export interface ProvenOperation extends BaseOperation {
  joinSplits: ProvenJoinSplit[];
}

export enum OperationStatus {
  QUEUED = "QUEUED",
  PRE_BATCH = "PRE_BATCH",
  IN_BATCH = "IN_BATCH",
  IN_FLIGHT = "IN_FLIGHT",
  EXECUTED_SUCCESS = "EXECUTED_SUCCESS",
  EXECUTED_FAILED = "EXECUTED_FAILED",
}
