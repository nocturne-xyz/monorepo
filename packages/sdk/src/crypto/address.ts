import { babyjub, poseidon } from "circomlibjs";
import { FlaxAddrPrefix } from "./common";
import { randomBytes } from "crypto";
import { Scalar } from "ffjavascript";

// TODO: Fix binary / base64 format of a FlaxAddress
export class FlaxAddress {
  h1: [bigint, bigint];
  h2: [bigint, bigint];

  constructor(h1: [bigint, bigint], h2: [bigint, bigint]) {
    this.h1 = h1;
    this.h2 = h2;
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

  toFlattened(): FlattenedFlaxAddress {
    return new FlattenedFlaxAddress({
      h1X: this.h1[0],
      h1Y: this.h1[1],
      h2X: this.h2[0],
      h2Y: this.h2[1],
    });
  }

  hash(): bigint {
    return this.toFlattened().hash();
  }

  rerand(): FlaxAddress {
    const r_buf = randomBytes(Math.floor(256 / 8));
    const r = Scalar.fromRprBE(r_buf, 0, 32);
    const H1 = babyjub.mulPointEscalar(this.h1, r);
    const H2 = babyjub.mulPointEscalar(this.h2, r);
    return new FlaxAddress(H1, H2);
  }
}

export interface FlattenedFlaxAddressConstructor {
  h1X: bigint;
  h1Y: bigint;
  h2X: bigint;
  h2Y: bigint;
}

export class FlattenedFlaxAddress {
  h1X: bigint;
  h1Y: bigint;
  h2X: bigint;
  h2Y: bigint;

  constructor({ h1X, h1Y, h2X, h2Y }: FlattenedFlaxAddressConstructor) {
    this.h1X = h1X;
    this.h1Y = h1Y;
    this.h2X = h2X;
    this.h2Y = h2Y;
  }

  hash(): bigint {
    return BigInt(poseidon([this.h1X, this.h1Y, this.h2X, this.h2Y]));
  }

  toArrayForm(): FlaxAddress {
    return new FlaxAddress([this.h1X, this.h1Y], [this.h2X, this.h2Y]);
  }
}
