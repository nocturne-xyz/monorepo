import { keccak256 } from "ethers/lib/utils";
import { toUtf8Bytes } from "ethers/lib/utils";
import { Action } from "./contract";
import { JoinSplitInputs } from "./proof/joinsplit";
import { CanonAddress, NocturneAddress } from "./crypto/address";
import { BaseProof, MerkleProofInput } from "./proof";
import { IncludedNote, Note } from "./sdk/note";

export const SNARK_SCALAR_FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const ERC20_ID = SNARK_SCALAR_FIELD - 1n; // TODO: fix

export type Address = string;
export type NoteAssetKey = string; // Takes form of NOTES_<address>_<id>
export type AllNotes = Map<NoteAssetKey, IncludedNote[]>;

export function hashAsset(asset: Asset): string {
  return keccak256(toUtf8Bytes(`${asset.assetAddr}:${asset.id.toString()}`));
}

export enum AssetType {
  ERC20,
  ERC721,
  ERC1155,
}

export function parseAssetType(type: string): AssetType {
  switch (parseInt(type)) {
    case 0:
      return AssetType.ERC20;
    case 1:
      return AssetType.ERC721;
    case 2:
      return AssetType.ERC1155;
    default:
      throw new Error(`Invalid asset type: ${type}`);
  }
}

export interface Asset {
  assetType: AssetType;
  assetAddr: Address;
  id: bigint;
}

export interface EncodedAsset {
  encodedAddr: bigint;
  encodedId: bigint;
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
  refundAddr?: NocturneAddress;
  refundAssets: Asset[];
  actions: Action[];
  gasLimit?: bigint;
  gasPrice?: bigint;
  maxNumRefunds?: bigint;
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
  encodedAddr: bigint;
  encodedId: bigint;
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

export interface BaseOperation {
  refundAddr: NocturneAddress;
  encodedRefundAssets: EncodedAsset[];
  actions: Action[];
  gasLimit: bigint;
  gasPrice: bigint;
  maxNumRefunds: bigint;
}

export interface PreSignOperation extends BaseOperation {
  joinSplitTxs: PreSignJoinSplitTx[];
}

export interface PreProofOperation extends BaseOperation {
  joinSplitTxs: PreProofJoinSplitTx[];
}

export interface ProvenOperation extends BaseOperation {
  joinSplitTxs: ProvenJoinSplitTx[];
}
