// @flow

import { babyjub, poseidon } from "circomlibjs";
import { randomBytes } from "crypto";
import { Scalar } from "ffjavascript";

// TODO: rewrite Babyjub library to have constant time crypto

const FlaxAddrPrefix = "0f";

export class FlaxPrivKey {
  vk: bigint; // a number between 0 and babyjub.subOrder - 1
  sk: bigint; // a number between 0 and babyjub.subOrder - 1

  constructor(vk: bigint, sk: bigint) {
    this.vk = vk;
    this.sk = sk;
  }

  static genPriv(): FlaxPrivKey {
    // TODO make vk and sk acutally uniformly distributed
    const vk_buf = randomBytes(Math.floor(256 / 8));
    const sk_buf = randomBytes(Math.floor(256 / 8));
    const vk = Scalar.fromRprBE(vk_buf, 0, 32) % babyjub.subOrder;
    const sk = Scalar.fromRprBE(sk_buf, 0, 32) % babyjub.subOrder;
    return new FlaxPrivKey(BigInt(vk), BigInt(sk));
  }

  toAddress(): FlaxAddress {
    const r_buf = randomBytes(Math.floor(256 / 8));
    const r = Scalar.fromRprBE(r_buf, 0, 32);
    const H1 = babyjub.mulPointEscalar(babyjub.Base8, r);
    const H2 = babyjub.mulPointEscalar(H1, this.vk);
    const H3 = babyjub.mulPointEscalar(H1, this.sk);
    return new FlaxAddress(H1, H2, H3);
  }
}

// TODO: Fix binary / base64 format of a FlaxAddress
export class FlaxAddress {
  H1: [bigint, bigint];
  H2: [bigint, bigint];
  H3: [bigint, bigint];

  constructor(
    h1: [bigint, bigint],
    h2: [bigint, bigint],
    h3: [bigint, bigint]
  ) {
    this.H1 = h1;
    this.H2 = h2;
    this.H3 = h3;
  }

  static parse(str: string): FlaxAddress {
    const base64str = str.slice(FlaxAddrPrefix.length);
    const b = Buffer.from(base64str, "base64");
    const b1 = b.slice(0, 32);
    const b2 = b.slice(32, 64);
    const b3 = b.slice(64, 96);
    const H1 = babyjub.unpackPoint(b1);
    const H2 = babyjub.unpackPoint(b2);
    const H3 = babyjub.unpackPoint(b3);
    return new FlaxAddress(H1, H2, H3);
  }

  toString(): string {
    const b1 = Buffer.from(babyjub.packPoint(this.H1));
    const b2 = Buffer.from(babyjub.packPoint(this.H2));
    const b3 = Buffer.from(babyjub.packPoint(this.H3));
    const b = Buffer.concat([b1, b2, b3]);
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
    const R = babyjub.mulPointEscalar(this.address.H1, r);
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

  static verify(addr: FlaxAddress, m: bigint, sig: FlaxSignature): boolean {
    const c = sig.c;
    const z = sig.z;
    const Z = babyjub.mulPointEscalar(addr.H1, z);
    const P = babyjub.mulPointEscalar(addr.H3, c);
    const R = babyjub.addPoint(Z, P);
    const cp = poseidon([R[0], R[1], m]);
    return c == cp;
  }

  testOwn(addr: FlaxAddress): boolean {
    const H2prime = babyjub.mulPointEscalar(addr.H1, this.privkey.vk);
    return addr.H2[0] === H2prime[0] && addr.H2[1] === H2prime[1];
  }
}

export function rerandAddr(addr: FlaxAddress): FlaxAddress {
  const r_buf = randomBytes(Math.floor(256 / 8));
  const r = Scalar.fromRprBE(r_buf, 0, 32);
  const H1 = babyjub.mulPointEscalar(addr.H1, r);
  const H2 = babyjub.mulPointEscalar(addr.H2, r);
  const H3 = babyjub.mulPointEscalar(addr.H3, r);
  return new FlaxAddress(H1, H2, H3);
}
