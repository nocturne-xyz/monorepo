import randomBytes from "randombytes";
import { BabyJubJub } from "./BabyJubJub";
import { bytesToNumberLE } from "@noble/curves/abstract/utils";

const Fr = BabyJubJub.ScalarField;
const Fp = BabyJubJub.BaseField;
const FR_WIDE_REDUCTION_BYTES = 64;
const FP_WIDE_REDUCTION_BYTES = 64;

export function randomFr(): bigint {
  const r_buf = randomBytes(FR_WIDE_REDUCTION_BYTES);
  const r = Fr.create(bytesToNumberLE(r_buf));
  return r;
}

export function randomFp(): bigint {
  const r_buf = randomBytes(FP_WIDE_REDUCTION_BYTES);
  const r = Fp.create(bytesToNumberLE(r_buf));
  return r;
}
