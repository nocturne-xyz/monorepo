import { babyjub, poseidon } from "circomlibjs";
import { FlaxAddrPrefix } from "./common";
import { randomBytes } from "crypto";
import { Scalar } from "ffjavascript";

export interface FlaxAddressStruct {
  h1X: bigint;
  h1Y: bigint;
  h2X: bigint;
  h2Y: bigint;
}

export function flattenedFlaxAddressToArrayForm(
  flattened: FlaxAddressStruct
): ArrayFlaxAddress {
  return {
    h1: [flattened.h1X, flattened.h1Y],
    h2: [flattened.h2X, flattened.h2Y],
  };
}

export function flattenedFlaxAddressFromJSON(
  jsonOrString: string | any
): FlaxAddressStruct {
  const json: any =
    typeof jsonOrString == "string" ? JSON.parse(jsonOrString) : jsonOrString;
  const { h1X, h1Y, h2X, h2Y } = json;
  return {
    h1X: BigInt(parseInt(h1X)),
    h1Y: BigInt(parseInt(h1Y)),
    h2X: BigInt(parseInt(h2X)),
    h2Y: BigInt(parseInt(h2Y)),
  };
}

export interface ArrayFlaxAddress {
  h1: [bigint, bigint];
  h2: [bigint, bigint];
}

// TODO: Fix binary / base64 format of a FlaxAddress
export class FlaxAddress {
  inner: FlaxAddressStruct;

  constructor(address: FlaxAddressStruct) {
    this.inner = address;
  }

  static fromArrayForm(address: ArrayFlaxAddress): FlaxAddress {
    const { h1, h2 } = address;
    return new FlaxAddress({
      h1X: h1[0],
      h1Y: h1[1],
      h2X: h2[0],
      h2Y: h2[1],
    });
  }

  toArrayForm(): ArrayFlaxAddress {
    return flattenedFlaxAddressToArrayForm(this.inner);
  }

  static parse(str: string): FlaxAddress {
    const base64str = str.slice(FlaxAddrPrefix.length);
    const b = Buffer.from(base64str, "base64");
    const b1 = b.slice(0, 32);
    const b2 = b.slice(32, 64);
    const h1 = babyjub.unpackPoint(b1) as [bigint, bigint];
    const h2 = babyjub.unpackPoint(b2) as [bigint, bigint];
    return FlaxAddress.fromArrayForm({ h1, h2 });
  }

  toString(): string {
    const { h1, h2 } = this.toArrayForm();
    const b1 = Buffer.from(babyjub.packPoint(h1));
    const b2 = Buffer.from(babyjub.packPoint(h2));
    const b = Buffer.concat([b1, b2]);
    return FlaxAddrPrefix + b.toString("base64");
  }

  toStruct(): FlaxAddressStruct {
    return this.inner;
  }

  hash(): bigint {
    const { h1X, h1Y, h2X, h2Y } = this.inner;
    return BigInt(poseidon([h1X, h1Y, h2X, h2Y]));
  }

  rerand(): FlaxAddress {
    const arrayAddr = this.toArrayForm();
    const r_buf = randomBytes(Math.floor(256 / 8));
    const r = Scalar.fromRprBE(r_buf, 0, 32);
    const h1 = babyjub.mulPointEscalar(arrayAddr.h1, r);
    const h2 = babyjub.mulPointEscalar(arrayAddr.h2, r);
    return FlaxAddress.fromArrayForm({ h1, h2 });
  }
}
