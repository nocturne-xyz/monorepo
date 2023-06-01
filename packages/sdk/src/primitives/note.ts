import { StealthAddressTrait, StealthAddress } from "../crypto";
import { Asset, AssetTrait, EncodedAsset } from "./asset";
import { poseidonBN } from "@nocturne-xyz/circuit-utils";
import { sha256 } from "js-sha256";
import { bigintToBEPadded } from "../utils";
import { EncryptedNote } from "./types";

export interface Note {
  owner: StealthAddress;
  nonce: bigint;
  asset: Asset;
  value: bigint;
}

export interface IncludedNote extends Note {
  merkleIndex: number;
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
    return Object.hasOwn(note, "encappedKey");
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
