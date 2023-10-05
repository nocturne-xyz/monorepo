import { ethers } from "ethers";
import { StealthAddressTrait } from "@nocturne-xyz/crypto";
import {
  AssetTrait,
  IncludedEncryptedNote,
  IncludedNote,
  Nullifier,
  TotalEntityIndex,
  TotalEntityIndexTrait,
  WithTotalEntityIndex,
  SubgraphUtils,
} from "@nocturne-xyz/core";

const { makeSubgraphQuery } = SubgraphUtils;

export type FilledBatchWithZerosEndMerkleIndex = number;
export type SDKEvent =
  | IncludedNote
  | IncludedEncryptedNote
  | Nullifier
  | FilledBatchWithZerosEndMerkleIndex;

// it's a plaintext note iff only those fields and merkleIndex are non-null
// it's an encrypted note iff only those fields and merkleIndex are non-null
// it's a nullifier iff only that field and merkleIndex are non-null
// it's a "filled batch with zeros up to" iff only `merkleIndex` is non-null
export interface SDKEventResponse {
  id: string;

  merkleIndex: string | null;

  encodedNoteOwnerH1: string | null;
  encodedNoteOwnerH2: string | null;
  encodedNoteEncodedAssetAddr: string | null;
  encodedNoteEncodedAssetId: string | null;
  encodedNoteValue: string | null;
  encodedNoteNonce: string | null;

  encryptedNoteCiphertextBytes: string | null;
  encryptedNoteEncapsulatedSecretBytes: string | null;
  encryptedNoteCommitment: string | null;

  nullifier: string | null;
}

export interface SDKEventsResponse {
  data: {
    sdkevents: SDKEventResponse[];
  };
}

export interface FetchSDKEventsVars {
  fromIdx: string;
}

export function makeSdkEventsQuery(toIdx?: TotalEntityIndex): string {
  const where = toIdx
    ? `{ id_gte: $fromIdx, id_lt: "${toIdx.toString()}" }`
    : "{ id_gte: $fromIdx }";
  return `\
query fetchSDKEvents($fromIdx: String!) {
  sdkevents(where: ${where}) {
    id
    merkleIndex

    encodedNoteOwnerH1
    encodedNoteOwnerH2
    encodedNoteEncodedAssetAddr
    encodedNoteEncodedAssetId
    encodedNoteValue
    encodedNoteNonce
  
    encryptedNoteCiphertextBytes
    encryptedNoteEncapsulatedSecretBytes
    encryptedNoteCommitment

    nullifier
  }
}`;
}

export async function fetchSDKEvents(
  endpoint: string,
  fromTotalEntityIndex: TotalEntityIndex,
  toTotalEntityIndex?: TotalEntityIndex
): Promise<WithTotalEntityIndex<SDKEvent>[]> {
  const query = makeSubgraphQuery<FetchSDKEventsVars, SDKEventsResponse>(
    endpoint,
    makeSdkEventsQuery(toTotalEntityIndex),
    "sdkEvents"
  );

  const fromIdx = TotalEntityIndexTrait.toStringPadded(fromTotalEntityIndex);
  const res = await query({ fromIdx });

  if (!res.data || res.data.sdkevents.length === 0) {
    return [];
  }

  return res.data.sdkevents.map((res) => {
    const { id } = res;
    const totalEntityIndex = BigInt(id);

    const event =
      tryIncludedNotefromSdkEventResponse(res) ??
      tryIncludedEncryptedNoteFromSdkEventResponse(res) ??
      tryNullifierFromSdkEventResponse(res) ??
      tryFilledBatchMerkleIndexFromSdkEventResponse(res);

    if (!event) {
      throw new Error("invalid sdk event");
    }

    return {
      inner: event,
      totalEntityIndex,
    };
  });
}

function tryIncludedNotefromSdkEventResponse(
  res: SDKEventResponse
): IncludedNote | undefined {
  if (
    res.merkleIndex !== null &&
    res.encodedNoteOwnerH1 !== null &&
    res.encodedNoteOwnerH2 !== null &&
    res.encodedNoteEncodedAssetAddr !== null &&
    res.encodedNoteEncodedAssetId !== null &&
    res.encodedNoteValue !== null &&
    res.encodedNoteNonce !== null &&
    res.encryptedNoteCiphertextBytes === null &&
    res.encryptedNoteEncapsulatedSecretBytes === null &&
    res.encryptedNoteCommitment === null &&
    res.nullifier === null
  ) {
    return {
      owner: StealthAddressTrait.decompress({
        h1: BigInt(res.encodedNoteOwnerH1),
        h2: BigInt(res.encodedNoteOwnerH2),
      }),
      asset: AssetTrait.decode({
        encodedAssetAddr: BigInt(res.encodedNoteEncodedAssetAddr),
        encodedAssetId: BigInt(res.encodedNoteEncodedAssetId),
      }),
      value: BigInt(res.encodedNoteValue),
      nonce: BigInt(res.encodedNoteNonce),
      merkleIndex: parseInt(res.merkleIndex),
    };
  }

  return undefined;
}

function tryIncludedEncryptedNoteFromSdkEventResponse(
  res: SDKEventResponse
): IncludedEncryptedNote | undefined {
  if (
    res.merkleIndex !== null &&
    res.encryptedNoteCiphertextBytes !== null &&
    res.encryptedNoteEncapsulatedSecretBytes !== null &&
    res.encryptedNoteCommitment !== null &&
    res.encodedNoteOwnerH1 === null &&
    res.encodedNoteOwnerH2 === null &&
    res.encodedNoteEncodedAssetAddr === null &&
    res.encodedNoteEncodedAssetId === null &&
    res.encodedNoteValue === null &&
    res.encodedNoteNonce === null &&
    res.nullifier === null
  ) {
    return {
      ciphertextBytes: Array.from(
        ethers.utils.arrayify(res.encryptedNoteCiphertextBytes)
      ),
      encapsulatedSecretBytes: Array.from(
        ethers.utils.arrayify(res.encryptedNoteEncapsulatedSecretBytes)
      ),
      commitment: BigInt(res.encryptedNoteCommitment),
      merkleIndex: parseInt(res.merkleIndex),
    };
  }

  return undefined;
}

function tryNullifierFromSdkEventResponse(
  res: SDKEventResponse
): Nullifier | undefined {
  if (
    res.nullifier !== null &&
    res.merkleIndex === null &&
    res.encodedNoteOwnerH1 === null &&
    res.encodedNoteOwnerH2 === null &&
    res.encodedNoteEncodedAssetAddr === null &&
    res.encodedNoteEncodedAssetId === null &&
    res.encodedNoteValue === null &&
    res.encodedNoteNonce === null &&
    res.encryptedNoteCiphertextBytes === null &&
    res.encryptedNoteEncapsulatedSecretBytes === null &&
    res.encryptedNoteCommitment === null
  ) {
    return BigInt(res.nullifier);
  }

  return undefined;
}

function tryFilledBatchMerkleIndexFromSdkEventResponse(
  res: SDKEventResponse
): FilledBatchWithZerosEndMerkleIndex | undefined {
  if (
    res.merkleIndex !== null &&
    res.encodedNoteOwnerH1 === null &&
    res.encodedNoteOwnerH2 === null &&
    res.encodedNoteEncodedAssetAddr === null &&
    res.encodedNoteEncodedAssetId === null &&
    res.encodedNoteValue === null &&
    res.encodedNoteNonce === null &&
    res.encryptedNoteCiphertextBytes === null &&
    res.encryptedNoteEncapsulatedSecretBytes === null &&
    res.encryptedNoteCommitment === null &&
    res.nullifier === null
  ) {
    return parseInt(res.merkleIndex);
  }

  return undefined;
}

export interface NoteResponse {
  ownerH1: string;
  ownerH2: string;
  nonce: string;
  encodedAssetAddr: string;
  encodedAssetId: string;
  value: string;
}

export interface EncryptedNoteResponse {
  ciphertextBytes: string;
  encapsulatedSecretBytes: string;
  commitment: string;
}

export interface EncodedOrEncryptedNoteResponse {
  id: string;
  merkleIndex: string;
  note: NoteResponse | null;
  encryptedNote: EncryptedNoteResponse | null;
}

interface FetchNotesResponse {
  data: {
    encodedOrEncryptedNotes: EncodedOrEncryptedNoteResponse[];
  };
}

interface FetchNotesVars {
  fromIdx: string;
}

const notesQuery = `\
query fetchNotes($fromIdx: String!) {
  encodedOrEncryptedNotes(where: { id_gte: $fromIdx }, first: 100) {
    id,
    merkleIndex
    note {
      ownerH1
      ownerH2
      encodedAssetAddr
      encodedAssetId
      value
    }
    encryptedNote {
      ciphertextBytes
      encapsulatedSecretBytes
      commitment
    }
  }
}`;

// gets first 100 notes on or after a given totalEntityIndex
export async function fetchNotes(
  endpoint: string,
  fromTotalEntityIndex: TotalEntityIndex
): Promise<WithTotalEntityIndex<IncludedNote | IncludedEncryptedNote>[]> {
  const query = makeSubgraphQuery<FetchNotesVars, FetchNotesResponse>(
    endpoint,
    notesQuery,
    "notes"
  );

  const fromIdx = TotalEntityIndexTrait.toStringPadded(fromTotalEntityIndex);
  const res = await query({ fromIdx });

  if (!res.data || res.data.encodedOrEncryptedNotes.length === 0) {
    return [];
  }

  return res.data.encodedOrEncryptedNotes.map(
    ({ merkleIndex, note, encryptedNote, id }) => {
      if (note) {
        return {
          inner: includedNoteFromNoteResponse(note, parseInt(merkleIndex)),
          totalEntityIndex: BigInt(id),
        };
      } else if (encryptedNote) {
        return {
          inner: encryptedNoteFromEncryptedNoteResponse(
            encryptedNote,
            parseInt(merkleIndex)
          ),
          totalEntityIndex: BigInt(id),
        };
      } else {
        throw new Error("res must contain either note or encryptedNote");
      }
    }
  );
}

export function includedNoteFromNoteResponse(
  noteResponse: NoteResponse,
  merkleIndex: number
): IncludedNote {
  const h1 = BigInt(noteResponse.ownerH1);
  const h2 = BigInt(noteResponse.ownerH2);
  const owner = StealthAddressTrait.decompress({ h1, h2 });

  const encodedAssetAddr = BigInt(noteResponse.encodedAssetAddr);
  const encodedAssetId = BigInt(noteResponse.encodedAssetId);
  const asset = AssetTrait.decode({ encodedAssetAddr, encodedAssetId });
  const nonce = BigInt(noteResponse.nonce);

  const value = BigInt(noteResponse.value);

  return {
    owner,
    asset,
    value,
    nonce,
    merkleIndex,
  };
}

export function encryptedNoteFromEncryptedNoteResponse(
  encryptedNoteResponse: EncryptedNoteResponse,
  merkleIndex: number
): IncludedEncryptedNote {
  const ciphertextBytes = Array.from(
    ethers.utils.arrayify(encryptedNoteResponse.ciphertextBytes)
  );
  const encapsulatedSecretBytes = Array.from(
    ethers.utils.arrayify(encryptedNoteResponse.encapsulatedSecretBytes)
  );
  const commitment = BigInt(encryptedNoteResponse.commitment);

  return {
    ciphertextBytes,
    encapsulatedSecretBytes,
    commitment,
    merkleIndex,
  };
}

interface FetchNullifiersResponse {
  data: {
    nullifiers: NullifierResponse[];
  };
}

interface FetchNullifiersVars {
  fromIdx: string;
}

interface NullifierResponse {
  id: string;
  nullifier: string;
}

const nullifiersQuery = `
  query fetchNullifiers($fromIdx: String!) {
    nullifiers(where: { id_gte: $fromIdx }, first: 100) {
      id,
      nullifier
    }
  }
`;

// gets first 100 nullifiers on or after a given totalEntityIndex
export async function fetchNullifiers(
  endpoint: string,
  fromTotalEntityIndex: TotalEntityIndex
): Promise<WithTotalEntityIndex<Nullifier>[]> {
  const query = makeSubgraphQuery<FetchNullifiersVars, FetchNullifiersResponse>(
    endpoint,
    nullifiersQuery,
    "nullifiers"
  );

  const fromIdx = TotalEntityIndexTrait.toStringPadded(fromTotalEntityIndex);
  const res = await query({ fromIdx });

  if (!res.data || res.data.nullifiers.length === 0) {
    return [];
  }

  return res.data.nullifiers.map(({ id, nullifier }) => ({
    inner: BigInt(nullifier),
    totalEntityIndex: BigInt(id),
  }));
}
