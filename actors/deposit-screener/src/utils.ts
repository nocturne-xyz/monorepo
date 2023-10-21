export interface RequestData {
  requestInfo: RequestInfo;
  requestInit: RequestInit;
}

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

export function requireApiKeys(): void {
  if (!process.env.MISTTRACK_API_KEY) {
    throw new Error("MISTTRACK_API_KEY not set");
  }
  if (!process.env.TRM_API_KEY) {
    throw new Error("TRM_API_KEY not set");
  }
}
