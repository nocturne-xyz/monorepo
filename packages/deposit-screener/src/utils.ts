export function secsToMillis(seconds: number): number {
  return seconds * 1000;
}

export function millisToSeconds(millis: number): number {
  return Math.floor(millis / 1000);
}
