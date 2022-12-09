export function numberToStringPadded(num: number, targetLen: number): string {
  let res = num.toString();
  if (res.length > targetLen) {
    throw new Error(`number ${num} is too large to fit in ${targetLen} digits`);
  } else if (res.length < targetLen) {
    res = "0".repeat(targetLen - res.length) + res;
  }

  return res;
}
