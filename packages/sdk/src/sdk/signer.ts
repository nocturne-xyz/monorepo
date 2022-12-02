import { babyjub, poseidon } from "circomlibjs";
import { randomBytes } from "crypto";
import { Scalar } from "ffjavascript";
import { Note, IncludedNoteStruct  } from "./note";
import {
  NocturneAddressStruct,
  flattenedNocturneAddressToArrayForm,
  NocturneAddress,
  CanonAddress,
} from "../crypto/address";
import { NocturnePrivKey } from "../crypto/privkey";
import { egcd, encodePoint, decodePoint, mod_p } from "./utils";
import { Address, NoteTransmission } from "../commonTypes";

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
   * Obtain the note from a note transmission. Assumes that the signer owns the
   * note transmission.
   *
   * @param noteTransmission
   * @param asset, id, merkleIndex additional params from the joinsplit event
   * @return note
   */
  getNoteFromNoteTransmission(
    noteTransmission: NoteTransmission,
    merkleIndex: number,
    asset: Address,
    id: bigint,
  ): IncludedNoteStruct {
    let [vkInv,,] = egcd(this.privkey.vk, babyjub.subOrder);
    if (vkInv < babyjub.subOrder) {
      vkInv += babyjub.subOrder;
    }
    const eR = decodePoint(noteTransmission.encappedKey);
    const R = babyjub.mulPointEscalar(eR, vkInv);
    const nonce = mod_p(noteTransmission.encryptedNonce - BigInt(poseidon([encodePoint(R)])));
    const value = mod_p(noteTransmission.encryptedValue - BigInt(poseidon([encodePoint(R) + 1n])));
    return {
      owner: this.privkey.toCanonAddressStruct(),
      nonce, asset, id, value, merkleIndex,
    };
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
