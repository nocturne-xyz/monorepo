import { CanonAddress } from "./address";
import { NoteTrait } from "../primitives";
import { EncryptedNote } from "../primitives/types";
import {
  BabyJubJub,
  HybridCipher,
  deserializeHybridCiphertext,
  serializeHybridCiphertext,
} from "@nocturne-xyz/crypto-utils";
import { NoteWithSender } from "../primitives/note";

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
export function encryptNote(
  receiver: CanonAddress,
  noteWithSender: NoteWithSender
): EncryptedNote {
  const { sender, ...note } = noteWithSender;
  const senderBytes = BabyJubJub.toBytes(sender);
  const noteBytes = NoteTrait.serializeCompact(note);

  const msg = new Uint8Array(senderBytes.length + noteBytes.length);
  msg.set(senderBytes);
  msg.set(noteBytes, senderBytes.length);

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
export function decryptNote(
  vk: bigint,
  encryptedNote: EncryptedNote
): NoteWithSender {
  const ciphertext = deserializeHybridCiphertext(encryptedNote);
  const msgBytes = cipher.decrypt(ciphertext, vk);

  const senderBytes = msgBytes.slice(0, BabyJubJub.NumBytes);
  const noteBytes = msgBytes.slice(BabyJubJub.NumBytes);

  const sender = BabyJubJub.fromBytes(senderBytes);
  if (!sender) throw new Error("Invalid sender");
  const note = NoteTrait.deserializeCompact(noteBytes);

  return { sender, ...note };
}
