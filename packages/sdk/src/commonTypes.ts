import { utils } from "ethers";
import { Action } from "./contract";
import { JoinSplitInputs } from "./proof/joinsplit";
import { CanonAddress, NocturneAddress } from "./crypto/address";
import { BaseProof, MerkleProofInput } from "./proof";
import { IncludedNote, Note } from "./sdk/note";

export const SNARK_SCALAR_FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const BLOCK_GAS_LIMIT = 30_000_000n;

export type Address = string;
export type NoteAssetKey = string; // Takes form of NOTES_<address>_<id>
export type AllNotes = Map<NoteAssetKey, IncludedNote[]>;

export function hashAsset(asset: Asset): string {
  return utils.keccak256(
    utils.toUtf8Bytes(`${asset.assetAddr}:${asset.id.toString()}`)
  );
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
  encodedAssetAddr: bigint;
  encodedAssetId: bigint;
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
  const encodedAssetId = BigInt(`0b000${idBits.slice(3)}`);
  const encodedAssetAddr = BigInt(
    `0b000${idTop3}${eightyEightZeros}${assetTypeBits}${addrBits}`
  );
  return { encodedAssetAddr, encodedAssetId };
}

export function decodeAsset(
  encodedAssetAddr: bigint,
  encodedAssetId: bigint
): Asset {
  const encodedAssetBits = encodedAssetAddr.toString(2).padStart(256, "0");
  const assetBits = encodedAssetBits.slice(96);
  const assetAddr =
    "0x" + BigInt(`0b${assetBits}`).toString(16).padStart(40, "0");

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
  const encodedIDBits = encodedAssetId.toString(2).padStart(256, "0").slice(3);
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
  encodedAsset: EncodedAsset;
  publicSpend: bigint;
  newNoteAEncrypted: EncryptedNote;
  newNoteBEncrypted: EncryptedNote;
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
  verificationGasLimit: bigint;
  executionGasLimit: bigint;
  maxNumRefunds: bigint;
  gasPrice: bigint;
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

export enum OperationStatus {
  QUEUED = "QUEUED",
  PRE_BATCH = "PRE_BATCH",
  IN_BATCH = "IN_BATCH",
  IN_FLIGHT = "IN_FLIGHT",
  EXECUTED_SUCCESS = "EXECUTED_SUCCESS",
  EXECUTED_FAILED = "EXECUTED_FAILED",
}
