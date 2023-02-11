export function range(start: number, stop?: number, step?: number): number[] {
  if (!stop) {
    stop = start;
    start = 0;
  }

  step = step ?? 1;

  return Array(Math.ceil((stop - start) / step))
  .fill(start)
  .map((x, i) => x + i * (step as number));
}
