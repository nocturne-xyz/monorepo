import { CanonAddress, StealthAddress, StealthAddressTrait } from "./address";
import { Note, Asset } from "../primitives";
import { assertOrErr } from "../utils";
import { EncryptedNote } from "../primitives/types";
import {
  AffinePoint,
  BabyJubJub,
  poseidonBN,
} from "@nocturne-xyz/circuit-utils";
import { randomFr } from "./utils";

const F = BabyJubJub.BaseField;
const Fr = BabyJubJub.ScalarField;

/**
 * Encrypt a note to be decrypted by a given receiver
 * @param receiver the receiver's canon address
 * @param note the note to be encrypted
 *
 * @returns the encrypted note
 *
 * @remarks
 * The viewing key corresponding to the receiver's canonical address is the decryption key
 */
export function encryptNote(receiver: CanonAddress, note: Note): EncryptedNote {
  const r = randomFr();
  const R = BabyJubJub.scalarMul(BabyJubJub.BasePoint, r);

  const encryptedNonce = F.add(
    poseidonBN([encodePoint(R)]),
    F.reduce(note.nonce)
  );
  const encryptedValue = F.add(
    poseidonBN([F.reduce(encodePoint(R) + F.One)]),
    F.reduce(note.value)
  );

  return {
    owner: StealthAddressTrait.randomize(note.owner),
    encappedKey: encodePoint(BabyJubJub.scalarMul(receiver, r)),
    encryptedNonce,
    encryptedValue,
  };
}

/**
 * Decrypt a note with the given viewing key
 * @param owner the owner of the note
 * @param vk the viewing key to decrypt the note with
 *
 * @returns the decrypted note
 *
 * @remarks
 * `vk` need not be the viewing key corresponding to the owner's canonical address. The decryption process
 * will work as long as `encryptedNote` was encrypted with `vk`'s corresponding `CanonicalAddress`
 */
export function decryptNote(
  owner: StealthAddress,
  vk: bigint,
  encryptedNote: EncryptedNote,
  asset: Asset
): Note {
  let vkInv = Fr.inv(vk);
  if (vkInv < BabyJubJub.PrimeSubgroupOrder) {
    vkInv += BabyJubJub.PrimeSubgroupOrder;
  }

  const eR = decodePoint(encryptedNote.encappedKey);
  const R = BabyJubJub.scalarMul(eR, vkInv);
  const nonce = F.sub(
    F.reduce(encryptedNote.encryptedNonce),
    F.reduce(poseidonBN([encodePoint(R)]))
  );

  const value = F.sub(
    F.reduce(encryptedNote.encryptedValue),
    F.reduce(poseidonBN([F.reduce(encodePoint(R) + 1n)]))
  );

  return {
    owner,
    nonce,
    asset,
    value,
  };
}

// Encode a Baby Jubjub point to the base field
function encodePoint(point: AffinePoint<bigint>): bigint {
  return point.x;
}

// Decode a Baby Jubjub point (on prime order subgroup) from a base field element
function decodePoint(x: bigint): AffinePoint<bigint> {
  const x2 = F.mul(F.reduce(x), F.reduce(x));
  const ax2 = F.mul(BabyJubJub.A, x2);
  const dx2 = F.mul(BabyJubJub.D, x2);
  const y2 = F.div(F.sub(ax2, F.One), F.sub(dx2, F.One));
  const y = F.sqrt(y2);
  assertOrErr(y !== undefined, "invalid point encoding");

  let point: AffinePoint<bigint> = { x, y: y! };
  if (!BabyJubJub.isInSubgroup(point)) {
    point = BabyJubJub.neg(point);
  }

  return point;
}
