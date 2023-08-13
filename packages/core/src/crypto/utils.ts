import { BabyJubJub } from "@nocturne-xyz/crypto-utils";
import randomBytes from "randombytes";

const Fr = BabyJubJub.ScalarField;
const FR_WIDE_REDUCTION_BYTES = 64;

export function randomFr(): bigint {
  const r_buf = randomBytes(FR_WIDE_REDUCTION_BYTES);
  const r = Fr.fromEntropy(r_buf);
  return r;
}
