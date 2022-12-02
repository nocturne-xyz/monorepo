import { keccak256 } from "ethers/lib/utils";
import { toUtf8Bytes } from "ethers/lib/utils";
import { Action, SpendAndRefundTokens } from "./contract";
import { JoinSplitInputs } from "./proof/joinsplit";
import { NocturneAddressStruct } from "./crypto/address";
import { MerkleProofInput } from "./proof";
import {
  IncludedNote,
  Note,
} from "./sdk/note";
import JSON from "json-bigint";

export const SNARK_SCALAR_FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const ERC20_ID = SNARK_SCALAR_FIELD - 1n; // TODO: fix

export type Address = string;
export type AssetHash = string;

export function hashAsset(asset: AssetStruct): string {
  return keccak256(toUtf8Bytes(`${asset.address}:${asset.id.toString()}`));
}

export interface AssetStruct {
  address: Address;
  id: bigint;
}

export function toJSON(object: any): string {
  return JSON.stringify(object, (_, value) =>
    typeof value === "bigint" ? value.toString() : value
  );
}

export function assetStructFromJSON(jsonOrString: any | string): AssetStruct {
  const json: any =
    typeof jsonOrString == "string" ? JSON.parse(jsonOrString) : jsonOrString;
  return {
    address: json.address,
    id: BigInt(json.id),
  };
}

export interface AssetRequest {
  asset: AssetStruct;
  value: bigint;
}

export function assetRequestFromJSON(jsonOrString: any | string): AssetRequest {
  const json: any =
    typeof jsonOrString == "string" ? JSON.parse(jsonOrString) : jsonOrString;
  return {
    asset: assetStructFromJSON(json.asset),
    value: BigInt(json.value),
  };
}

export interface OperationRequest {
  assetRequests: AssetRequest[];
  refundTokens: Address[]; // TODO: ensure hardcoded address for no refund tokens
  actions: Action[];
}

export function operationRequestFromJSON(
  jsonOrString: any | string
): OperationRequest {
  const json: any =
    typeof jsonOrString == "string" ? JSON.parse(jsonOrString) : jsonOrString;
  return {
    assetRequests: json.assetRequests.map((j: any) => assetRequestFromJSON(j)),
    refundTokens: json.refundTokens,
    actions: json.actions.map((a: any) => {
      return {
        contractAddress: a.contractAddress,
        encodedFunction: a.encodedFunction,
      };
    }),
  };
}

export interface NoteTransmission {
  owner: NocturneAddressStruct;
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
  proofInputs: JoinSplitInputs
}

export interface ProvenJoinSplitTx extends BaseJoinSplitTx {
  proof: [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
}

export interface PreSignOperation {
  joinSplitTxs: PreSignJoinSplitTx[];
  refundAddr: NocturneAddressStruct;
  tokens: SpendAndRefundTokens;
  actions: Action[];
  gasLimit: bigint;
}

export interface PreProofOperation {
  joinSplitTxs: PreProofJoinSplitTx[];
  refundAddr: NocturneAddressStruct;
  tokens: SpendAndRefundTokens;
  actions: Action[];
  gasLimit: bigint;
}

export interface ProvenOperation {
  joinSplitTxs: ProvenJoinSplitTx[];
  refundAddr: NocturneAddressStruct;
  tokens: SpendAndRefundTokens;
  actions: Action[];
  gasLimit: bigint;
}
