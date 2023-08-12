import {
  CanonAddress,
  EncryptedCanonAddress,
  StealthAddress,
  StealthAddressTrait,
} from "./address";
import { Note, Asset } from "../primitives";
import { EncryptedNote } from "../primitives/types";
import { BabyJubJub, poseidonBN } from "@nocturne-xyz/circuit-utils";
import { randomFr } from "./utils";
import { decompressPoint, compressPoint } from "./pointCompression";

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
    poseidonBN([compressPoint(R)]),
    F.reduce(note.nonce)
  );
  const encryptedValue = F.add(
    poseidonBN([F.reduce(compressPoint(R) + F.One)]),
    F.reduce(note.value)
  );

  return {
    owner: StealthAddressTrait.compress(
      StealthAddressTrait.randomize(note.owner)
    ),
    encappedKey: compressPoint(BabyJubJub.scalarMul(receiver, r)),
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

  const eR = decompressPoint(encryptedNote.encappedKey);
  if (!eR) {
    throw new Error("Invalid encapped key");
  }

  const R = BabyJubJub.scalarMul(eR, vkInv);
  const nonce = F.sub(
    F.reduce(encryptedNote.encryptedNonce),
    F.reduce(poseidonBN([compressPoint(R)]))
  );

  const value = F.sub(
    F.reduce(encryptedNote.encryptedValue),
    F.reduce(poseidonBN([F.reduce(compressPoint(R) + 1n)]))
  );

  return {
    owner,
    nonce,
    asset,
    value,
  };
}

// ElGamal encryption using receiver's canonical address as the public key (vk the private key)
export function encryptCanonAddr(
  plaintext: CanonAddress,
  pubkey: CanonAddress,
  nonce: bigint
): EncryptedCanonAddress {
  const s = BabyJubJub.scalarMul(pubkey, nonce);
  const c1 = BabyJubJub.scalarMul(BabyJubJub.BasePoint, nonce);
  const c2 = BabyJubJub.add(plaintext, s);

  return {
    c1: compressPoint(c1),
    c2: compressPoint(c2),
  };
}

export function decryptCanonAddr(
  ciphertext: EncryptedCanonAddress,
  vk: bigint
): CanonAddress {
  const c1 = decompressPoint(ciphertext.c1);
  const c2 = decompressPoint(ciphertext.c2);

  if (!c1 || !c2) {
    throw new Error("Invalid ciphertext");
  }

  const sInv = BabyJubJub.scalarMul(c1, Fr.neg(vk));
  return BabyJubJub.add(c2, sInv);
}
