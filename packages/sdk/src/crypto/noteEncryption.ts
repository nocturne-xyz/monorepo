import { CanonAddress } from "./address";
import { Note, NoteTrait } from "../primitives";
import { EncryptedNote } from "../primitives/types";
import {
  BabyJubJub,
  HybridCipher,
  deserializeHybridCiphertext,
  serializeHybridCiphertext,
} from "@nocturne-xyz/crypto-utils";

const cipher = new HybridCipher(BabyJubJub, 64);

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
  const noteBytes = NoteTrait.serializeCompact(note);
  const ciphertext = cipher.encrypt(noteBytes, receiver);
  return serializeHybridCiphertext(ciphertext);
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
export function decryptNote(vk: bigint, encryptedNote: EncryptedNote): Note {
  const ciphertext = deserializeHybridCiphertext(encryptedNote);
  const noteBytes = cipher.decrypt(ciphertext, vk);
  return NoteTrait.deserializeCompact(noteBytes);
}
