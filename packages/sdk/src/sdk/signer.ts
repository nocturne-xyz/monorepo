import { babyjub, poseidon } from "circomlibjs";
import { randomBytes } from "crypto";
import { Scalar } from "ffjavascript";
import { Note  } from "./note";
import {
  NocturneAddressStruct,
  flattenedNocturneAddressToArrayForm,
  NocturneAddress,
  CanonAddress,
} from "../crypto/address";
import { NocturnePrivKey } from "../crypto/privkey";
import { egcd, encodePoint, decodePoint, mod_p } from "../sdk/utils";

export interface NocturneSignature {
  c: bigint;
  z: bigint;
}

export class NocturneSigner {
  privkey: NocturnePrivKey;
  address: NocturneAddress;
  canonAddress: CanonAddress;

  constructor(privkey: NocturnePrivKey) {
    const address = privkey.toAddress();

    this.privkey = privkey;
    this.canonAddress = privkey.toCanonAddress();
    this.address = address;
  }

  sign(m: bigint): NocturneSignature {
    // TODO: make this deterministic
    const r_buf = randomBytes(Math.floor(256 / 8));
    const r = Scalar.fromRprBE(r_buf, 0, 32) % babyjub.subOrder;
    const R = babyjub.mulPointEscalar(babyjub.Base8, r);
    const c = poseidon([R[0], R[1], m]);

    // eslint-disable-next-line
    let z = (r - (this.privkey.sk as any) * c) % babyjub.subOrder;
    if (z < 0) {
      z += babyjub.subOrder;
    }

    return {
      c: BigInt(c),
      z: BigInt(z),
    };
  }

  static verify(
    pk: [bigint, bigint],
    m: bigint,
    sig: NocturneSignature
  ): boolean {
    const c = sig.c;
    const z = sig.z;
    const Z = babyjub.mulPointEscalar(babyjub.Base8, z);
    const P = babyjub.mulPointEscalar(pk, c);
    const R = babyjub.addPoint(Z, P);
    const cp = poseidon([R[0], R[1], m]);
    return c == cp;
  }

  createNullifier(note: Note): bigint {
    if (!this.testOwn(note.owner)) {
      throw Error("Attempted to create nullifier for note you do not own");
    }

    return BigInt(poseidon([note.toCommitment(), this.privkey.vk]));
  }

  generateNewNonce(oldNullifier: bigint): bigint {
    return poseidon([this.privkey.vk, oldNullifier]);
  }

  /**
   * Encrypt a note to a list of target addresses.
   * TODO: this is non privkey dependent, maybe move out of signer?
   *
   * @param targets: list of canonical NocturnAddress
   * @param note: note to encrypt
   * @return r: encryption randomness
   * @return encappedKeys: encapsulated keys, each is an encoded
   * point, for each target
   * @return encryptedNote: symetrically encrypted note
   */
  encryptNote(
    targets: CanonAddress[],
    note: Note
  ): [bigint, bigint[], bigint, bigint] {
    const r_buf = randomBytes(Math.floor(256 / 8));
    const r = Scalar.fromRprBE(r_buf, 0, 32) % babyjub.subOrder;
    const R = babyjub.mulPointEscalar(babyjub.Base8, r);
    const encryptedNonce = mod_p(
      BigInt(poseidon([encodePoint(R)])) + note.nonce
    );
    const encryptedValue = mod_p(
      BigInt(poseidon([encodePoint(R) + 1n])) + note.value
    );
    const encappedKeys: bigint[] = targets.map((addr) => {
      return encodePoint(babyjub.mulPointEscalar(addr, r));
    });
    return [BigInt(r), encappedKeys, encryptedNonce, encryptedValue];
  }

  /**
   * Decrypt an encrypted note, assuming that encappedKey is
   * generated against the stored viewing key. Returns the decrypted
   * nonce and value.
   *
   * @param encappedKey: encapsulated key
   * @param encryptedNonce
   * @param encryptedValue
   * @return nonce
   * @return value
   */
  decryptNote(
    encappedKey: bigint,
    encryptedNonce: bigint,
    encryptedValue: bigint
  ): [bigint, bigint] {
    let [vkInv,,] = egcd(this.privkey.vk, babyjub.subOrder);
    if (vkInv < babyjub.subOrder) {
      vkInv += babyjub.subOrder;
    }
    const eR = decodePoint(encappedKey);
    const R = babyjub.mulPointEscalar(eR, vkInv);
    const nonce = mod_p(encryptedNonce - BigInt(poseidon([encodePoint(R)])));
    const value = mod_p(encryptedValue - BigInt(poseidon([encodePoint(R) + 1n])));
    return [nonce, value];
  }

  testOwn(addr: NocturneAddress | NocturneAddressStruct): boolean {
    const nocturneAddr =
      addr instanceof NocturneAddress
        ? addr.toArrayForm()
        : flattenedNocturneAddressToArrayForm(addr);
    const H2prime = babyjub.mulPointEscalar(nocturneAddr.h1, this.privkey.vk);
    return (
      nocturneAddr.h2[0] === H2prime[0] && nocturneAddr.h2[1] === H2prime[1]
    );
  }
}
