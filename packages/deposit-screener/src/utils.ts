export function secsToMillis(seconds: number): number {
  return seconds * 1000;
}

export function millisToSeconds(millis: number): number {
  return Math.floor(millis / 1000);
}

export function divideDecimalPreserving(
  a: bigint,
  b: bigint,
  precision: number
): number {
  return Number((a * 10n ** BigInt(precision)) / b) / 10 ** precision;
}

export const MAGIC_LONG_DELAY_VALUE = 10101000000000000n; // 0.010101
export const MAGIC_ZERO_DELAY_VALUE = 20202000000000000n; // 0.020202
export const MAGIC_REJECTION_VALUE = 30303000000000000n; // 0.030303

// TODO
// ! Needs real implementation as we progress towards mainnet
export function dummySafeDepositCheck(value: bigint): boolean {
  const env = process.env.ENVIRONMENT;
  if (env === "production") return false;
  return value !== MAGIC_REJECTION_VALUE;
}
