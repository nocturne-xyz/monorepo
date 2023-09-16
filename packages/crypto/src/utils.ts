import { bytesToNumberLE } from "@noble/curves/abstract/utils";
import { BabyJubJub } from "./BabyJubJub";
import randomBytes from "randombytes";

const Fr = BabyJubJub.ScalarField;
const FR_WIDE_REDUCTION_BYTES = 64;

export function randomFr(): bigint {
  const r_buf = randomBytes(FR_WIDE_REDUCTION_BYTES);
  const r = Fr.create(bytesToNumberLE(r_buf));
  return r;
}

export function assert(cond: boolean, msg?: string): void {
  if (!cond) throw new Error(msg);
}
