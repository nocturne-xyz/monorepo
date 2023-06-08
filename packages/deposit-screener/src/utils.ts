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

export function formatMetricLabel(
  actor: string,
  component: string,
  label: string
): string {
  return `nocturne.${actor}.${component}.${label}`;
}
