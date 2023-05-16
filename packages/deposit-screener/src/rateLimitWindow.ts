export interface RateLimitWindowEntry {
  // unix millis timestamp when the deposit was fulfilled
  timestamp: number;
  // the deposit amount
  amount: bigint;
}

export class RateLimitWindow {
  rateLimit: bigint;
  period: number;
  sum: bigint;
  window: RateLimitWindowEntry[];

  constructor(rateLimit: bigint, period: number) {
    this.window = [];
    this.sum = 0n;
    this.rateLimit = rateLimit;
    this.period = period;
  }

  wouldExceedRateLimit(amount: bigint): boolean {
    return this.sum + amount > this.rateLimit;
  }

  windowSum(): bigint {
    return this.sum;
  }

  add(entry: RateLimitWindowEntry): void {
    this.window.push(entry);
    this.sum += entry.amount;
  }

  removeOldEntries(): void {
    const cutoff = Date.now() - this.period;

    let i = 0;
    while (i < this.window.length && this.window[i].timestamp < cutoff) {
      this.sum -= this.window[i].amount;
      i++;
    }

    this.window.splice(0, i);
  }

  // returns timestamp at which the rate limit can support depositing the given amount
  timeWhenAmountAvailable(amount: bigint): number {
    let i = 0;
    let sum = 0n;
    while (i < this.window.length && sum < amount) {
      sum += this.window[i].amount;
      i++;
    }

    return this.period + this.window[i - 1].timestamp;
  }
}
