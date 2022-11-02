import { babyjub, poseidon } from "circomlibjs";
import { randomBytes } from "crypto";
import { Scalar } from "ffjavascript";
import { Note } from "./note";
import {
  FlaxAddressStruct,
  flattenedFlaxAddressToArrayForm,
  FlaxAddress,
} from "../crypto/address";
import { FlaxPrivKey } from "../crypto/privkey";

export interface FlaxSignature {
  c: bigint;
  z: bigint;
}

export class FlaxSigner {
  privkey: FlaxPrivKey;
  address: FlaxAddress;

  constructor(privkey: FlaxPrivKey) {
    const address = privkey.toAddress();

    this.privkey = privkey;
    this.address = address;
  }

  sign(m: bigint): FlaxSignature {
    // TODO: make this deterministic
    const r_buf = randomBytes(Math.floor(256 / 8));
    const r = Scalar.fromRprBE(r_buf, 0, 32);
    const R = babyjub.mulPointEscalar(babyjub.Base8, r);
    const c = poseidon([R[0], R[1], m]);

    // eslint-disable-next-line
    let z = (r - (this.privkey.sk as any) * c) % babyjub.subOrder; // TODO: remove any cast
    if (z < 0) {
      z += babyjub.subOrder;
    }

    return {
      c: BigInt(c),
      z: BigInt(z),
    };
  }

  static verify(pk: [bigint, bigint], m: bigint, sig: FlaxSignature): boolean {
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

    return BigInt(poseidon([this.privkey.vk, note.toCommitment()]));
  }

  generateNewNonce(oldNullifier: bigint): bigint {
    return poseidon([this.privkey.vk, oldNullifier]);
  }

  testOwn(addr: FlaxAddress | FlaxAddressStruct): boolean {
    const flaxAddr =
      addr instanceof FlaxAddress
        ? addr.toArrayForm()
        : flattenedFlaxAddressToArrayForm(addr);
    const H2prime = babyjub.mulPointEscalar(flaxAddr.h1, this.privkey.vk);
    return flaxAddr.h2[0] === H2prime[0] && flaxAddr.h2[1] === H2prime[1];
  }
}
