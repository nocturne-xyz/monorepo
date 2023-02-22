import { StealthAddressTrait, StealthAddress } from "./crypto";
import { Asset, AssetTrait, EncodedAsset } from "./asset";
import { poseidonBN } from "@nocturne-xyz/circuit-utils";
import { sha256 } from "js-sha256";
import { bigintToBEPadded } from "@nocturne-xyz/base-utils";

export interface Note {
  owner: StealthAddress;
  nonce: bigint;
  asset: Asset;
  value: bigint;
}

export interface IncludedNote extends Note {
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
  static toCommitment(note: Note): bigint {
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

  static sha256(note: Note): number[] {
    const noteInput = NoteTrait.encode(note);
    const ownerH1 = bigintToBEPadded(noteInput.owner.h1X, 32);
    const ownerH2 = bigintToBEPadded(noteInput.owner.h2X, 32);
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

  static toIncludedNote(
    { owner, nonce, asset, value }: Note,
    merkleIndex: number
  ): IncludedNote {
    return { owner, nonce, asset, value, merkleIndex };
  }

  static encode(note: Note): EncodedNote {
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
