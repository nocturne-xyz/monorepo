import { keccak256 } from "ethers/lib/utils";
import { toUtf8Bytes } from "ethers/lib/utils";
import { Action, SpendAndRefundTokens } from "./contract";
import { JoinSplitInputs } from "./proof/joinsplit";
import { CanonAddress, NocturneAddress } from "./crypto/address";
import { BaseProof, MerkleProofInput } from "./proof";
import { IncludedNote, Note } from "./sdk/note";

export const SNARK_SCALAR_FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const ERC20_ID = SNARK_SCALAR_FIELD - 1n; // TODO: fix

export type Address = string;
export type NotesKey = string; // Takes form of NOTES_<address>_<id>

export function hashAsset(asset: Asset): string {
  return keccak256(toUtf8Bytes(`${asset.address}:${asset.id.toString()}`));
}

export interface Asset {
  address: Address;
  id: bigint;
}

export interface AssetWithBalance {
  asset: Asset;
  balance: bigint;
}

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
  refundTokens: Address[]; // TODO: ensure hardcoded address for no refund tokens
  actions: Action[];
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
    BigInt(proof.pi_c[1])
  ];
}

export interface NoteTransmission {
  owner: NocturneAddress;
  encappedKey: bigint;
  encryptedNonce: bigint;
  encryptedValue: bigint;
}

export interface BaseJoinSplitTx {
  commitmentTreeRoot: bigint;
  nullifierA: bigint;
  nullifierB: bigint;
  newNoteACommitment: bigint;
  newNoteBCommitment: bigint;
  asset: Address;
  id: bigint;
  publicSpend: bigint;
  newNoteATransmission: NoteTransmission;
  newNoteBTransmission: NoteTransmission;
}

export interface PreSignJoinSplitTx extends BaseJoinSplitTx {
  oldNoteA: IncludedNote;
  oldNoteB: IncludedNote;
  newNoteA: Note;
  newNoteB: Note;
  merkleInputA: MerkleProofInput;
  merkleInputB: MerkleProofInput;
}

export interface PreProofJoinSplitTx extends BaseJoinSplitTx {
  opDigest: bigint;
  proofInputs: JoinSplitInputs;
}

export interface ProvenJoinSplitTx extends BaseJoinSplitTx {
  proof: SolidityProof;
}

export interface PreSignOperation {
  joinSplitTxs: PreSignJoinSplitTx[];
  refundAddr: NocturneAddress;
  tokens: SpendAndRefundTokens;
  actions: Action[];
  gasLimit: bigint;
}

export interface PreProofOperation {
  joinSplitTxs: PreProofJoinSplitTx[];
  refundAddr: NocturneAddress;
  tokens: SpendAndRefundTokens;
  actions: Action[];
  gasLimit: bigint;
}

export interface ProvenOperation {
  joinSplitTxs: ProvenJoinSplitTx[];
  refundAddr: NocturneAddress;
  tokens: SpendAndRefundTokens;
  actions: Action[];
  gasLimit: bigint;
}
