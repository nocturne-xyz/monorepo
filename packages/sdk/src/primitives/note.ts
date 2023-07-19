import { StealthAddressTrait, StealthAddress, CanonAddress } from "../crypto";
import { Asset, AssetTrait, EncodedAsset } from "./asset";
import { poseidonBN } from "@nocturne-xyz/crypto-utils";
import { sha256 } from "js-sha256";
import { bigintToBEPadded } from "../utils";
import { EncryptedNote } from "./types";
import { bigintFromBEBytes } from "../utils/bits";

export interface Note {
  owner: StealthAddress;
  nonce: bigint;
  asset: Asset;
  value: bigint;
}

export interface IncludedNote extends Note {
  merkleIndex: number;
}

export interface NoteWithSender extends Note {
  sender: CanonAddress;
}

export interface IncludedNoteWithNullifier extends IncludedNote {
  nullifier: bigint;
}

export interface IncludedNoteCommitment {
  noteCommitment: bigint;
  merkleIndex: number;
}

export interface EncodedNote {
  owner: StealthAddress;
  nonce: bigint;
  encodedAssetAddr: bigint;
  encodedAssetId: bigint;
  value: bigint;
}

// compact note byte-serialization format (181 bytes)
// all bigints are represented in big-endian encoding
// 1. owner: 64 bytes (h1Compressed: 32 bytes, h2Compressed: 32 bytes)
// 2. asset: 53 bytes (AssetTrait.serializeCompact(asset))
// 3. nonce: 32 bytes
// 4. value: 32 bytes
const NOTE_COMPACT_SERIALIZE_BYTES = 181;
const NOTE_COMPACT_SERIALIZE_OFFSETS = {
  owner: {
    h1: 0,
    h2: 32,
  },
  asset: 64,
  nonce: 117,
  value: 149,
  end: 181,
};

export class NoteTrait {
  static toCommitment<N extends Note>(note: N): bigint {
    const { owner, nonce, encodedAssetAddr, encodedAssetId, value } =
      NoteTrait.encode(note);
    return BigInt(
      poseidonBN([
        StealthAddressTrait.hash(owner),
        nonce,
        encodedAssetAddr,
        encodedAssetId,
        value,
      ])
    );
  }

  static emptyNoteCommitment(): bigint {
    return BigInt(
      poseidonBN([
        StealthAddressTrait.hash({
          h1X: 0n,
          h1Y: 0n,
          h2X: 0n,
          h2Y: 0n,
        }),
        0n,
        0n,
        0n,
        0n,
      ])
    );
  }

  static toIncludedCommitment<N extends IncludedNote>(
    includedNote: N
  ): IncludedNoteCommitment {
    const { merkleIndex } = includedNote;
    const noteCommitment = NoteTrait.toCommitment(includedNote);
    return { noteCommitment, merkleIndex };
  }

  static isCommitment<N extends Note>(
    noteOrCommitment: N | IncludedNoteCommitment | bigint
  ): boolean {
    return (
      typeof noteOrCommitment === "bigint" ||
      Object.hasOwn(noteOrCommitment, "noteCommitment")
    );
  }

  static isEncryptedNote<N extends Note, E extends EncryptedNote>(
    note: N | E
  ): boolean {
    return Object.hasOwn(note, "encapsulatedSecretBytes");
  }

  static sha256<N extends Note>(note: N): number[] {
    const noteInput = NoteTrait.encode(note);
    const { h1, h2 } = StealthAddressTrait.compress(noteInput.owner);
    const ownerH1 = bigintToBEPadded(h1, 32);
    const ownerH2 = bigintToBEPadded(h2, 32);
    const nonce = bigintToBEPadded(noteInput.nonce, 32);
    const asset = bigintToBEPadded(noteInput.encodedAssetAddr, 32);
    const id = bigintToBEPadded(noteInput.encodedAssetId, 32);
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

  static toIncludedNote<N extends Note>(
    { owner, nonce, asset, value }: N,
    merkleIndex: number
  ): IncludedNote {
    return { owner, nonce, asset, value, merkleIndex };
  }

  static toIncludedNoteWithNullifier<N extends IncludedNote>(
    { owner, nonce, asset, value, merkleIndex }: N,
    nullifier: bigint
  ): IncludedNoteWithNullifier {
    return { owner, nonce, asset, value, merkleIndex, nullifier };
  }

  static toNote<N extends Note>({ owner, nonce, asset, value }: N): Note {
    return { owner, nonce, asset, value };
  }

  // see above for serialization format
  static serializeCompact<N extends Note>(note: N): Uint8Array {
    const buf = new Uint8Array(NOTE_COMPACT_SERIALIZE_BYTES);

    const { owner, nonce, asset, value } = note;
    const { h1, h2 } = StealthAddressTrait.compress(owner);

    buf.set(bigintToBEPadded(h1, 32), NOTE_COMPACT_SERIALIZE_OFFSETS.owner.h1);
    buf.set(bigintToBEPadded(h2, 32), NOTE_COMPACT_SERIALIZE_OFFSETS.owner.h2);
    buf.set(
      AssetTrait.serializeCompact(asset),
      NOTE_COMPACT_SERIALIZE_OFFSETS.asset
    );
    buf.set(bigintToBEPadded(nonce, 32), NOTE_COMPACT_SERIALIZE_OFFSETS.nonce);
    buf.set(bigintToBEPadded(value, 32), NOTE_COMPACT_SERIALIZE_OFFSETS.value);

    return buf;
  }

  static deserializeCompact(buf: Uint8Array): Note {
    const h1 = bigintFromBEBytes(
      buf.slice(
        NOTE_COMPACT_SERIALIZE_OFFSETS.owner.h1,
        NOTE_COMPACT_SERIALIZE_OFFSETS.owner.h2
      )
    );
    const h2 = bigintFromBEBytes(
      buf.slice(
        NOTE_COMPACT_SERIALIZE_OFFSETS.owner.h2,
        NOTE_COMPACT_SERIALIZE_OFFSETS.asset
      )
    );
    const compressedOwner = { h1, h2 };
    const owner = StealthAddressTrait.decompress(compressedOwner);

    const asset = AssetTrait.deserializeCompact(
      buf.slice(
        NOTE_COMPACT_SERIALIZE_OFFSETS.asset,
        NOTE_COMPACT_SERIALIZE_OFFSETS.nonce
      )
    );
    const nonce = bigintFromBEBytes(
      buf.slice(
        NOTE_COMPACT_SERIALIZE_OFFSETS.nonce,
        NOTE_COMPACT_SERIALIZE_OFFSETS.value
      )
    );
    const value = bigintFromBEBytes(
      buf.slice(
        NOTE_COMPACT_SERIALIZE_OFFSETS.value,
        NOTE_COMPACT_SERIALIZE_OFFSETS.end
      )
    );

    return { owner, nonce, asset, value };
  }

  static encode<N extends Note>(note: N): EncodedNote {
    const { owner, nonce, value } = note;
    const { encodedAssetAddr, encodedAssetId } = AssetTrait.encode(note.asset);

    return {
      owner,
      nonce,
      encodedAssetAddr: encodedAssetAddr,
      encodedAssetId: encodedAssetId,
      value,
    };
  }

  static decode(encodedNote: EncodedNote): Note {
    const { owner, nonce, value, encodedAssetAddr, encodedAssetId } =
      encodedNote;

    const encodedAsset: EncodedAsset = {
      encodedAssetAddr,
      encodedAssetId,
    };

    const asset = AssetTrait.decode(encodedAsset);

    return {
      owner,
      nonce,
      asset,
      value,
    };
  }
}
