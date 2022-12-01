import {
  hashNocturneAddress,
  NocturneAddress,
  nocturneAddressFromJSON,
} from "../crypto/address";
import { Address } from "../commonTypes";
import { poseidon } from "circomlibjs";
import { sha256 } from "js-sha256";
import { bigintToBEPadded } from "./utils";
import { NoteInput } from "../proof";
import JSON from "json-bigint";

export interface Note {
  owner: NocturneAddress;
  nonce: bigint;
  asset: Address;
  id: bigint;
  value: bigint;
}

export function noteFromJSON(jsonOrString: string | any): Note {
  const json: any =
    typeof jsonOrString == "string" ? JSON.parse(jsonOrString) : jsonOrString;
  const { owner, nonce, asset, id, value } = json;
  return {
    owner: nocturneAddressFromJSON(owner),
    nonce: BigInt(nonce),
    asset: asset.toString(),
    id: BigInt(id),
    value: BigInt(value),
  };
}

export function noteToCommitment({
  owner,
  nonce,
  asset,
  id,
  value,
}: Note): bigint {
  return BigInt(
    poseidon([hashNocturneAddress(owner), nonce, BigInt(asset), id, value])
  );
}

export function noteToNoteInput({
  owner,
  nonce,
  asset,
  id,
  value,
}: Note): NoteInput {
  return {
    owner: owner,
    nonce: nonce,
    asset: BigInt(asset),
    id: id,
    value: value,
  };
}

export function sha256Note(note: Note): number[] {
  const noteInput = noteToNoteInput(note);
  const ownerH1 = bigintToBEPadded(noteInput.owner.h1X, 32);
  const ownerH2 = bigintToBEPadded(noteInput.owner.h2X, 32);
  const nonce = bigintToBEPadded(noteInput.nonce, 32);
  const asset = bigintToBEPadded(noteInput.asset, 32);
  const id = bigintToBEPadded(noteInput.id, 32);
  const value = bigintToBEPadded(noteInput.value, 32);

  const preimage = [
    ...ownerH1,
    ...ownerH2,
    ...nonce,
    ...asset,
    ...id,
    ...value,
  ];
  return sha256.array(preimage);
}

export function noteToIncludedNote(
  { owner, nonce, asset, id, value }: Note,
  merkleIndex: number
): IncludedNote {
  return { owner, nonce, asset, id, value, merkleIndex };
}

export interface IncludedNote extends Note {
  merkleIndex: number;
}

export function includedNoteFromJSON(jsonOrString: string | any): IncludedNote {
  const json: any =
    typeof jsonOrString == "string" ? JSON.parse(jsonOrString) : jsonOrString;
  const { owner, nonce, asset, id, value, merkleIndex } = json;
  return {
    owner: nocturneAddressFromJSON(owner),
    nonce: BigInt(nonce),
    asset: asset.toString(),
    id: BigInt(id),
    value: BigInt(value),
    merkleIndex,
  };
}
