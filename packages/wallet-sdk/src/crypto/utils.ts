import { BabyJubJub } from "@nocturne-xyz/circuit-utils";
import randomBytes from "randombytes";

const BIGINT_BYTES = 32;
const Fr = BabyJubJub.ScalarField;

export function randomBigInt(): bigint {
  const rand = randomBytes(BIGINT_BYTES);
  return BigInt("0x" + rand.toString("hex"));
}

export function randomFr(): bigint {
  const r_buf = randomBytes(BIGINT_BYTES);
  const r = Fr.fromBytes(r_buf);
  return r;
}
