// @flow

import { babyjub, poseidon } from "circomlibjs";
import { randomBytes } from "crypto";
import { Scalar } from "ffjavascript";

// TODO: rewrite Babyjub library to have constant time crypto

const FlaxAddrPrefix = "0f";

export class FlaxPrivKey {
  vk: bigint; // a number between 0 and babyjub.subOrder - 1
  sk: bigint; // a number between 0 and babyjub.subOrder - 1

  constructor(sk: bigint) {
    this.sk = sk;
    const spendPk = babyjub.mulPointEscalar(babyjub.Base8, this.sk);
    const spendPkNonce = BigInt(1);
    this.vk = poseidon([spendPk[0], spendPk[1], spendPkNonce]);
  }

  static genPriv(): FlaxPrivKey {
    // TODO make sk acutally uniformly distributed
    const sk_buf = randomBytes(Math.floor(256 / 8));
    const sk = Scalar.fromRprBE(sk_buf, 0, 32) % babyjub.subOrder;
    return new FlaxPrivKey(BigInt(sk));
  }

  toAddress(): FlaxAddress {
    const r_buf = randomBytes(Math.floor(256 / 8));
    const r = Scalar.fromRprBE(r_buf, 0, 32);
    const H1 = babyjub.mulPointEscalar(babyjub.Base8, r);
    const H2 = babyjub.mulPointEscalar(H1, this.vk);
    return new FlaxAddress(H1, H2);
  }

  spendPk(): [bigint, bigint] {
    return babyjub.mulPointEscalar(babyjub.Base8, this.sk);
  }
}

// TODO: Fix binary / base64 format of a FlaxAddress
export class FlaxAddress {
  h1: [bigint, bigint];
  h2: [bigint, bigint];

  constructor(h1: [bigint, bigint], h2: [bigint, bigint]) {
    this.h1 = h1;
    this.h2 = h2;
  }

  hash(): bigint {
    const H1Hash = poseidon([this.h1[0], this.h1[1]]);
    const H2Hash = poseidon([this.h2[0], this.h2[1]]);
    return BigInt(poseidon([H1Hash, H2Hash]));
  }

  static parse(str: string): FlaxAddress {
    const base64str = str.slice(FlaxAddrPrefix.length);
    const b = Buffer.from(base64str, "base64");
    const b1 = b.slice(0, 32);
    const b2 = b.slice(32, 64);
    const H1 = babyjub.unpackPoint(b1);
    const H2 = babyjub.unpackPoint(b2);
    return new FlaxAddress(H1, H2);
  }

  toString(): string {
    const b1 = Buffer.from(babyjub.packPoint(this.h1));
    const b2 = Buffer.from(babyjub.packPoint(this.h2));
    const b = Buffer.concat([b1, b2]);
    return FlaxAddrPrefix + b.toString("base64");
  }
}

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
