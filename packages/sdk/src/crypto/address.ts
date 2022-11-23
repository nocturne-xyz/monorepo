import { babyjub, poseidon } from "circomlibjs";
import { AnonAddrPrefix } from "./common";
import { randomBytes } from "crypto";
import { Scalar } from "ffjavascript";

export interface CanonicalAddress {
  X: bigint;
  Y: bigint;
}

export interface AnonAddressStruct {
  h1X: bigint;
  h1Y: bigint;
  h2X: bigint;
  h2Y: bigint;
}

export function flattenedAnonAddressToArrayForm(
  flattened: AnonAddressStruct
): ArrayAnonAddress {
  return {
    h1: [flattened.h1X, flattened.h1Y],
    h2: [flattened.h2X, flattened.h2Y],
  };
}

export function flattenedAnonAddressFromJSON(
  jsonOrString: string | any
): AnonAddressStruct {
  const json: any =
    typeof jsonOrString == "string" ? JSON.parse(jsonOrString) : jsonOrString;
  const { h1X, h1Y, h2X, h2Y } = json;
  return {
    h1X: BigInt(h1X),
    h1Y: BigInt(h1Y),
    h2X: BigInt(h2X),
    h2Y: BigInt(h2Y),
  };
}

export interface ArrayAnonAddress {
  h1: [bigint, bigint];
  h2: [bigint, bigint];
}

// TODO: Fix binary / base64 format of an AnonAddress
export class AnonAddress {
  inner: AnonAddressStruct;

  constructor(address: AnonAddressStruct) {
    this.inner = address;
  }

  static fromArrayForm(address: ArrayAnonAddress): AnonAddress {
    const { h1, h2 } = address;
    return new AnonAddress({
      h1X: h1[0],
      h1Y: h1[1],
      h2X: h2[0],
      h2Y: h2[1],
    });
  }

  toArrayForm(): ArrayAnonAddress {
    return flattenedAnonAddressToArrayForm(this.inner);
  }

  static parse(str: string): AnonAddress {
    const base64str = str.slice(AnonAddrPrefix.length);
    const b = Buffer.from(base64str, "base64");
    const b1 = b.slice(0, 32);
    const b2 = b.slice(32, 64);
    const h1 = babyjub.unpackPoint(b1) as [bigint, bigint];
    const h2 = babyjub.unpackPoint(b2) as [bigint, bigint];
    return AnonAddress.fromArrayForm({ h1, h2 });
  }

  toString(): string {
    const { h1, h2 } = this.toArrayForm();
    const b1 = Buffer.from(babyjub.packPoint(h1));
    const b2 = Buffer.from(babyjub.packPoint(h2));
    const b = Buffer.concat([b1, b2]);
    return AnonAddrPrefix + b.toString("base64");
  }

  toStruct(): AnonAddressStruct {
    return this.inner;
  }

  hash(): bigint {
    const { h1X, h2X } = this.inner;
    return BigInt(poseidon([h1X, h2X]));
  }

  rerand(): AnonAddress {
    const arrayAddr = this.toArrayForm();
    const r_buf = randomBytes(Math.floor(256 / 8));
    const r = Scalar.fromRprBE(r_buf, 0, 32);
    const h1 = babyjub.mulPointEscalar(arrayAddr.h1, r);
    const h2 = babyjub.mulPointEscalar(arrayAddr.h2, r);
    return AnonAddress.fromArrayForm({ h1, h2 });
  }
}
