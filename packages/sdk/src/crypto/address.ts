import { babyjub, poseidon } from "circomlibjs";
import { NocturneAddrPrefix } from "./common";
import { randomBytes } from "ethers/lib/utils";
import { Scalar } from "ffjavascript";

export interface NocturneAddress {
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

export class NocturneAddressTrait {
  static toPoints(flattened: NocturneAddress): AddressPoints {
    return {
      h1: [flattened.h1X, flattened.h1Y],
      h2: [flattened.h2X, flattened.h2Y],
    };
  }

  static fromPoints(addressPoints: AddressPoints): NocturneAddress {
    const { h1, h2 } = addressPoints;
    return {
      h1X: h1[0],
      h1Y: h1[1],
      h2X: h2[0],
      h2Y: h2[1],
    };
  }

  static toString(address: NocturneAddress): string {
    const { h1, h2 } = NocturneAddressTrait.toPoints(address);
    const b1 = babyjub.packPoint(h1);
    const b2 = babyjub.packPoint(h2);
    const b = [...b1, ...b2];
    const encoded = btoa(String.fromCharCode.apply(null, b));
    return NocturneAddrPrefix + encoded;
  }

  static fromString(str: string): NocturneAddress {
    const base64str = str.slice(NocturneAddrPrefix.length);
    const b = Uint8Array.from(atob(base64str), (c) => c.charCodeAt(0));
    const b1 = b.slice(0, 32);
    const b2 = b.slice(32, 64);
    const h1 = babyjub.unpackPoint(b1) as [bigint, bigint];
    const h2 = babyjub.unpackPoint(b2) as [bigint, bigint];
    return NocturneAddressTrait.fromPoints({ h1, h2 });
  }

  static hash(address: NocturneAddress): bigint {
    const { h1X, h2X } = address;
    return BigInt(poseidon([h1X, h2X]));
  }

  static randomize(address: NocturneAddress): NocturneAddress {
    const points = NocturneAddressTrait.toPoints(address);
    const r_buf = randomBytes(Math.floor(256 / 8));
    const r = Scalar.fromRprBE(r_buf, 0, 32);
    const h1 = babyjub.mulPointEscalar(points.h1, r);
    const h2 = babyjub.mulPointEscalar(points.h2, r);
    return NocturneAddressTrait.fromPoints({ h1, h2 });
  }

  static fromCanonAddress(canonAddr: CanonAddress): NocturneAddress {
    return {
      h1X: BigInt(babyjub.Base8[0]),
      h1Y: BigInt(babyjub.Base8[1]),
      h2X: BigInt(canonAddr[0]),
      h2Y: BigInt(canonAddr[1]),
    };
  }
}
