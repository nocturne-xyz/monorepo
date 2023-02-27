import randomBytes from "randombytes";

const BIGINT_BYTES = 8;

export function randomBigInt(): bigint {
  const rand = randomBytes(BIGINT_BYTES);
  return BigInt("0x" + rand.toString("hex"));
}
