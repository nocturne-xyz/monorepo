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

export function encodeAsset({ assetType, assetAddr, id }: Asset): EncodedAsset {
  const eightyEightZeros = "".padStart(88, "0");
  const addrBits = BigInt(assetAddr).toString(2).padStart(160, "0");
  if (addrBits.length > 160) {
    throw new Error("number repr of `asset` is too large");
  }

  let assetTypeBits: string;
  switch (assetType) {
    case AssetType.ERC20: {
      assetTypeBits = "00";
      break;
    }
    case AssetType.ERC721: {
      assetTypeBits = "01";
      break;
    }
    case AssetType.ERC1155: {
      assetTypeBits = "10";
      break;
    }
  }

  const idBits = id.toString(2).padStart(256, "0");
  const idTop3 = idBits.slice(0, 3);
  const encodedId = BigInt(`0b000${idBits.slice(3)}`);
  const encodedAddr = BigInt(
    `0b000${idTop3}${eightyEightZeros}${assetTypeBits}${addrBits}`
  );
  return { encodedAddr, encodedId };
}

export function decodeAsset(encodedAddr: bigint, encodedId: bigint): Asset {
  const encodedAssetBits = encodedAddr.toString(2).padStart(256, "0");
  const assetBits = encodedAssetBits.slice(96);
  const assetAddr = "0x" + BigInt(`0b${assetBits}`).toString(16);

  const assetTypeBits = encodedAssetBits.slice(94, 96);
  let assetType: AssetType;
  switch (assetTypeBits) {
    case "00":
      assetType = AssetType.ERC20;
      break;
    case "01":
      assetType = AssetType.ERC721;
      break;
    case "10":
      assetType = AssetType.ERC1155;
      break;
    default:
      throw new Error("invalid asset type bits");
  }

  const idTop3 = encodedAssetBits.slice(3, 6);
  const encodedIDBits = encodedId.toString(2).padStart(256, "0").slice(3);
  const id = BigInt(`0b${idTop3}${encodedIDBits}`);

  return {
    assetType,
    assetAddr,
    id,
  };
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
  executionGasLimit?: bigint;
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
  executionGasLimit: bigint;
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
