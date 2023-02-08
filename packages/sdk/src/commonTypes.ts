import { Action } from "./contract";
import { JoinSplitInputs } from "./proof/joinsplit";
import { CanonAddress, StealthAddress } from "./crypto/address";
import { BaseProof, MerkleProofInput } from "./proof";
import { IncludedNote, Note } from "./sdk/note";
import { Asset, EncodedAsset } from "./sdk/asset";

export const SNARK_SCALAR_FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const BLOCK_GAS_LIMIT = 30_000_000n;

export type Address = string;
export type NoteAssetKey = string; // Takes form of NOTES_<address>_<id>
export type AllNotes = Map<NoteAssetKey, IncludedNote[]>;

export interface UnwrapRequest {
  asset: Asset;
  unwrapValue: bigint;
}

export interface PaymentIntent {
  receiver: CanonAddress;
  value: bigint;
}

// A joinsplit request is an unwrapRequest plus an optional payment
export interface JoinSplitRequest extends UnwrapRequest {
  paymentIntent?: PaymentIntent;
}

export interface OperationRequest {
  joinSplitRequests: JoinSplitRequest[];
  refundAddr?: StealthAddress;
  refundAssets: Asset[];
  actions: Action[];
  verificationGasLimit?: bigint;
  executionGasLimit?: bigint;
  maxNumRefunds?: bigint;
  gasPrice?: bigint;
}

export type SolidityProof = [
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint
];

export function packToSolidityProof(proof: BaseProof): SolidityProof {
  return [
    BigInt(proof.pi_a[0]),
    BigInt(proof.pi_a[1]),
    BigInt(proof.pi_b[0][1]),
    BigInt(proof.pi_b[0][0]),
    BigInt(proof.pi_b[1][1]),
    BigInt(proof.pi_b[1][0]),
    BigInt(proof.pi_c[0]),
    BigInt(proof.pi_c[1]),
  ];
}

export function unpackFromSolidityProof(proof: SolidityProof): BaseProof {
  return {
    pi_a: [proof[0], proof[1], 1n],
    pi_b: [
      [proof[3], proof[2]],
      [proof[5], proof[4]],
      [1n, 0n],
    ],
    pi_c: [proof[6], proof[7], 1n],
    protocol: "groth16",
    curve: "bn128",
  };
}

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

export interface PreSignJoinSplit extends BaseJoinSplit {
  oldNoteA: IncludedNote;
  oldNoteB: IncludedNote;
  newNoteA: Note;
  newNoteB: Note;
  merkleInputA: MerkleProofInput;
  merkleInputB: MerkleProofInput;
}

export interface PreProofJoinSplit extends BaseJoinSplit {
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
  verificationGasLimit: bigint;
  executionGasLimit: bigint;
  maxNumRefunds: bigint;
  gasPrice: bigint;
}

export interface PreSignOperation extends BaseOperation {
  joinSplits: PreSignJoinSplit[];
}

export interface PreProofOperation extends BaseOperation {
  joinSplits: PreProofJoinSplit[];
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
