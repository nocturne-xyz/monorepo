import { babyjub, poseidon } from "circomlibjs";
import { NocturneAddrPrefix } from "./common";
import { randomBytes } from "crypto";
import { Scalar } from "ffjavascript";
// import JSON from "json-bigint";

export interface NocturneAddress {
  h1X: bigint;
  h1Y: bigint;
  h2X: bigint;
  h2Y: bigint;
}

export interface ArrayNocturneAddress {
  h1: [bigint, bigint];
  h2: [bigint, bigint];
}


export function nocturneAddressFromJSON(
  jsonOrString: string | any
): NocturneAddress {
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

export function nocturneAddressToArrayForm(
  flattened: NocturneAddress
): ArrayNocturneAddress {
  return {
    h1: [flattened.h1X, flattened.h1Y],
    h2: [flattened.h2X, flattened.h2Y],
  };
}

export function nocturneAddressFromArrayForm(arrayAddress: ArrayNocturneAddress): NocturneAddress {
  const { h1, h2 } = arrayAddress;
  return {
    h1X: h1[0],
    h1Y: h1[1],
    h2X: h2[0],
    h2Y: h2[1],
  };
}

export function nocturneAddressToString(address: NocturneAddress): string {
    const { h1, h2 } = nocturneAddressToArrayForm(address);
    const b1 = Buffer.from(babyjub.packPoint(h1));
    const b2 = Buffer.from(babyjub.packPoint(h2));
    const b = Buffer.concat([b1, b2]);
    return NocturneAddrPrefix + b.toString("base64");
}

export function nocturneAddressFromString(str: string): NocturneAddress {
  const base64str = str.slice(NocturneAddrPrefix.length);
  const b = Buffer.from(base64str, "base64");
  const b1 = b.slice(0, 32);
  const b2 = b.slice(32, 64);
  const h1 = babyjub.unpackPoint(b1) as [bigint, bigint];
  const h2 = babyjub.unpackPoint(b2) as [bigint, bigint];
  return nocturneAddressFromArrayForm({ h1, h2 });
}

export function hashNocturneAddress(address: NocturneAddress): bigint {
    const { h1X, h2X } = address;
    return BigInt(poseidon([h1X, h2X]));
}

export function rerandNocturneAddress(address: NocturneAddress): NocturneAddress {
      const arrayAddr = nocturneAddressToArrayForm(address);
    const r_buf = randomBytes(Math.floor(256 / 8));
    const r = Scalar.fromRprBE(r_buf, 0, 32);
    const h1 = babyjub.mulPointEscalar(arrayAddr.h1, r);
    const h2 = babyjub.mulPointEscalar(arrayAddr.h2, r);
    return nocturneAddressFromArrayForm({ h1, h2 });
}