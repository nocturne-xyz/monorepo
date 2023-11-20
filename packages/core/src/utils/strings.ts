// this function stringifies a number `num` and padds it with leading zeros to `targetLen` digits
// this is used to ensure that stringified numbers are oredered the same way as numbers
export function numberToStringPadded(
  num: bigint,
  targenLen: number,
  radix?: number
): string;
export function numberToStringPadded(
  num: number,
  targetLen: number,
  radix?: number
): string;
export function numberToStringPadded(
  num: bigint | number,
  targetLen: number,
  radix = 10
): string {
  let res = num.toString(radix);
  if (res.length > targetLen) {
    throw new Error(`number ${num} is too large to fit in ${targetLen} digits`);
  } else if (res.length < targetLen) {
    res = "0".repeat(targetLen - res.length) + res;
  }

  return res;
}
