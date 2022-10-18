import { babyjub, poseidon } from "circomlibjs";
import { FlaxAddressInput } from "../proof/spend2";
import { FlaxAddrPrefix } from "./common";

// TODO: Fix binary / base64 format of a FlaxAddress
export class FlaxAddress {
  h1: [bigint, bigint];
  h2: [bigint, bigint];

  constructor(h1: [bigint, bigint], h2: [bigint, bigint]) {
    this.h1 = h1;
    this.h2 = h2;
  }

  hash(): bigint {
    return BigInt(poseidon([this.h1[0], this.h1[1], this.h2[0], this.h2[1]]));
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

  toFlattened(): FlaxAddressInput {
    return {
      h1X: this.h1[0],
      h1Y: this.h1[1],
      h2X: this.h2[0],
      h2Y: this.h2[1],
    };
  }
}
