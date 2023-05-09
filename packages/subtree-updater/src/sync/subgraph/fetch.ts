import {
  AssetTrait,
  IncludedNote,
  IncludedNoteCommitment,
  StealthAddress,
  SubgraphUtils,
} from "@nocturne-xyz/sdk";

const { makeSubgraphQuery, totalEntityIndexFromBlockNumber } = SubgraphUtils;

interface NoteResponse {
  ownerH1X: string;
  ownerH1Y: string;
  ownerH2X: string;
  ownerH2Y: string;
  nonce: string;
  encodedAssetAddr: string;
  encodedAssetId: string;
  value: string;
}

interface EncryptedNoteResponse {
  id: string;
  idx: string;
  ownerH1X: string;
  ownerH1Y: string;
  ownerH2X: string;
  ownerH2Y: string;
  encappedKey: string;
  encryptedNonce: string;
  encryptedValue: string;
  encodedAssetAddr: string;
  encodedAssetId: string;
  commitment: string;
}

interface EncodedOrEncryptedNoteResponse {
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
  fromMerkleIndex: string;
  toMerkleIndex: string;
  toEntityIndex: string;
}

const notesQuery = `\
query fetchNotes($fromMerkleIndex: BigInt!, $toMerkleIndex: BigInt!, $toEntityIndex: Bytes!) {
  encodedOrEncryptedNotes(where: { merkleIdx_gte: $fromMerkleIndex, merkleIdx_lt: $toMerkleIndex, idx_lt: $toEntityIndex}) {
    merkleIndex
    note {
      ownerH1X
      ownerH1Y
      ownerH2X
      ownerH2Y
      nonce
      encodedAssetAddr
      encodedAssetId
      value
    }
    encryptedNote {
      commitment
    }
  }
}`;

// gets note or note commitments for the given merkle index range, up to `toBlock`
// the range is inclusive - i.e. [fromMerkleIndex, toMerkleIndex]
export async function fetchNotesOrCommitments(
  endpoint: string,
  fromMerkleIndex: number,
  toMerkleIndex: number,
  toBlock: number
): Promise<(IncludedNote | IncludedNoteCommitment)[]> {
  const query = makeSubgraphQuery<FetchNotesVars, FetchNotesResponse>(
    endpoint,
    notesQuery,
    "notes"
  );

  const toEntityIndex = totalEntityIndexFromBlockNumber(
    BigInt(toBlock + 1)
  ).toString();
  const res = await query({
    fromMerkleIndex: fromMerkleIndex.toString(),
    toMerkleIndex: toMerkleIndex.toString(),
    toEntityIndex,
  });
  return res.data.encodedOrEncryptedNotes.map(
    ({ merkleIndex, note, encryptedNote }) => {
      if (note) {
        return includedNoteFromNoteResponse(note, parseInt(merkleIndex));
      } else if (encryptedNote) {
        return {
          merkleIndex: parseInt(merkleIndex),
          noteCommitment: BigInt(encryptedNote.commitment),
        };
      } else {
        throw new Error("res must contain either note or encryptedNote");
      }
    }
  );
}

function includedNoteFromNoteResponse(
  noteResponse: NoteResponse,
  merkleIndex: number
): IncludedNote {
  const h1X = BigInt(noteResponse.ownerH1X);
  const h1Y = BigInt(noteResponse.ownerH1Y);
  const h2X = BigInt(noteResponse.ownerH2X);
  const h2Y = BigInt(noteResponse.ownerH2Y);
  const owner: StealthAddress = {
    h1X,
    h1Y,
    h2X,
    h2Y,
  };

  const encodedAssetAddr = BigInt(noteResponse.encodedAssetAddr);
  const encodedAssetId = BigInt(noteResponse.encodedAssetId);
  const asset = AssetTrait.decode({ encodedAssetAddr, encodedAssetId });

  const nonce = BigInt(noteResponse.nonce);
  const value = BigInt(noteResponse.value);

  return {
    owner,
    asset,
    nonce,
    value,

    merkleIndex,
  };
}
