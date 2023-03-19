import IORedis from "ioredis";

const PER_ADDR_DEPOSIT_PREFIX = "PER_ADDR_DEPOSIT_AMOUNT_";
const GLOBAL_DEPOSIT_KEY = "GLOBAL_DEPOSIT_AMOUNT";

export class RateLimitDB {
  redis: IORedis;

  constructor(redis: IORedis) {
    this.redis = redis;
  }

  private static formatPerAddressDepositKey(address: string): string {
    return PER_ADDR_DEPOSIT_PREFIX + address;
  }

  async setDepositAmountForAddress(
    address: string,
    amount: number
  ): Promise<void> {
    const key = RateLimitDB.formatPerAddressDepositKey(address);
    this.redis.set(key, amount);
  }

  async getDepositAmountForAddress(address: string): Promise<number> {
    const key = RateLimitDB.formatPerAddressDepositKey(address);
    const val = await this.redis.get(key);
    return val ? Number(val) : 0;
  }

  async setGlobalDepositAmount(amount: number): Promise<void> {
    this.redis.set(GLOBAL_DEPOSIT_KEY, amount);
  }

  async getGlobalDepositAmount(amount: number): Promise<number> {
    const val = await this.redis.get(GLOBAL_DEPOSIT_KEY);
    return val ? Number(val) : 0;
  }
}
