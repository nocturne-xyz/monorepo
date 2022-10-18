import { babyjub, poseidon } from "circomlibjs";
import { randomBytes } from "crypto";
import { Scalar } from "ffjavascript";
import { FlaxAddress } from "./address";
import { FlaxPrivKey } from "./privkey";

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

  testOwn(addr: FlaxAddress): boolean {
    const H2prime = babyjub.mulPointEscalar(addr.h1, this.privkey.vk);
    return addr.h2[0] === H2prime[0] && addr.h2[1] === H2prime[1];
  }
}

export function rerandAddr(addr: FlaxAddress): FlaxAddress {
  const r_buf = randomBytes(Math.floor(256 / 8));
  const r = Scalar.fromRprBE(r_buf, 0, 32);
  const H1 = babyjub.mulPointEscalar(addr.h1, r);
  const H2 = babyjub.mulPointEscalar(addr.h2, r);
  return new FlaxAddress(H1, H2);
}
