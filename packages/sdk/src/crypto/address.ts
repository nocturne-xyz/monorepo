import { babyjub, poseidon } from "circomlibjs";
import { StealthAddrPrefix } from "./common";
import randomBytes from "randombytes";
import { Scalar } from "ffjavascript";
import { Buffer } from "buffer";

export interface StealthAddress {
  h1X: bigint;
  h1Y: bigint;
  h2X: bigint;
  h2Y: bigint;
}

export type CanonAddress = [bigint, bigint];

export interface AddressPoints {
  h1: [bigint, bigint];
  h2: [bigint, bigint];
}

export class StealthAddressTrait {
  static toPoints(flattened: StealthAddress): AddressPoints {
    return {
      h1: [flattened.h1X, flattened.h1Y],
      h2: [flattened.h2X, flattened.h2Y],
    };
  }

  static fromPoints(addressPoints: AddressPoints): StealthAddress {
    const { h1, h2 } = addressPoints;
    return {
      h1X: h1[0],
      h1Y: h1[1],
      h2X: h2[0],
      h2Y: h2[1],
    };
  }

  static toString(address: StealthAddress): string {
    const { h1, h2 } = StealthAddressTrait.toPoints(address);
    const b1 = Buffer.from(babyjub.packPoint(h1));
    const b2 = Buffer.from(babyjub.packPoint(h2));
    const b = Buffer.concat([b1, b2]);
    return StealthAddrPrefix + b.toString("base64");
  }

  static fromString(str: string): StealthAddress {
    const base64str = str.slice(StealthAddrPrefix.length);
    const b = Buffer.from(base64str, "base64");
    const b1 = b.subarray(0, 32);
    const b2 = b.subarray(32, 64);
    const h1 = babyjub.unpackPoint(b1) as [bigint, bigint];
    const h2 = babyjub.unpackPoint(b2) as [bigint, bigint];
    return StealthAddressTrait.fromPoints({ h1, h2 });
  }

  static hash(address: StealthAddress): bigint {
    const { h1X, h2X } = address;
    return BigInt(poseidon([h1X, h2X]));
  }

  static randomize(address: StealthAddress): StealthAddress {
    const points = StealthAddressTrait.toPoints(address);
    const r_buf = randomBytes(Math.floor(256 / 8));
    const r = Scalar.fromRprBE(r_buf, 0, 32);
    const h1 = babyjub.mulPointEscalar(points.h1, r);
    const h2 = babyjub.mulPointEscalar(points.h2, r);
    return StealthAddressTrait.fromPoints({ h1, h2 });
  }

  static fromCanonAddress(canonAddr: CanonAddress): StealthAddress {
    return {
      h1X: BigInt(babyjub.Base8[0]),
      h1Y: BigInt(babyjub.Base8[1]),
      h2X: BigInt(canonAddr[0]),
      h2Y: BigInt(canonAddr[1]),
    };
  }
}
