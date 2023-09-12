import { assertOrErr } from "./error";

export interface HistogramMap {
  [name: string]: Histogram;
}

export class Histogram {
  name: string;
  needsSort: boolean;
  values: number[];

  constructor(name: string) {
    this.name = name;
    this.values = [];
    this.needsSort = false;
  }

  /// adds a list of values to the histogram
  sample(...values: number[]): void {
    this.values.push(...values);
  }

  /// clears the histogram
  clear(): void {
    this.values = [];
  }

  /// computes the mean
  mean(): number {
    return this.values.reduce((a, b) => a + b, 0) / this.values.length;
  }

  /// computes the standard deviation
  stddev(): number {
    const mean = this.mean();
    const variance =
      this.values.reduce((a, b) => a + (b - mean) ** 2, 0) / this.values.length;
    return Math.sqrt(variance);
  }

  /// computes percentiles given a list of percentiles in percent
  /// e.g. percentiles([10, 50, 90]) returns [p10, p50, p90]
  /// percentiles can be fractional (e.g. the "0.1th" percentile)
  percentiles(percentiles: number[]): number[] {
    assertOrErr(
      percentiles.every((p) => p >= 0),
      "percentiles must be >= 0"
    );
    
    if (this.needsSort) {
      this.values.sort();
      this.needsSort = false;
    }

    return percentiles
      .map((p) => [Math.floor(p), p - Math.floor(p)])
      .map(
        ([ri, rf]) =>
          this.values[ri] + rf * (this.values[ri + 1] - this.values[ri])
      );
  }
}
