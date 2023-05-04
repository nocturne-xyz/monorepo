import { DepositRequest } from "@nocturne-xyz/sdk";
import IORedis from "ioredis";
import { hashDepositRequest } from "./typedData";
import { DepositRequestStatus } from "./types";

const NEXT_BLOCK_KEY = "NEXT_BLOCK";

const DEPOSIT_REQUEST_STAGE_PREFIX = "DEPOSIT_REQUEST_STAGE_";
const PER_ADDR_DEPOSIT_AMOUNT_PREFIX = "PER_ADDR_DEPOSIT_AMOUNT_";

const GLOBAL_DEPOSIT_AMOUNT_KEY = "GLOBAL_DEPOSIT_AMOUNT";

export class DepositScreenerDB {
  redis: IORedis;

  constructor(redis: IORedis) {
    this.redis = redis;
  }

  private static formatDepositRequestStatusKey(
    depositRequest: DepositRequest
  ): string {
    return DEPOSIT_REQUEST_STAGE_PREFIX + hashDepositRequest(depositRequest);
  }

  private static formatPerAddressDepositAmountKey(address: string): string {
    return PER_ADDR_DEPOSIT_AMOUNT_PREFIX + address;
  }

  async setNextBlock(block: number): Promise<void> {
    await this.redis.set(NEXT_BLOCK_KEY, block);
  }

  async getNextBlock(): Promise<number | undefined> {
    const val = await this.redis.get(NEXT_BLOCK_KEY);
    return val ? Number(val) : undefined;
  }

  async setDepositRequestStatus(
    depositRequest: DepositRequest,
    status: DepositRequestStatus
  ): Promise<void> {
    const key = DepositScreenerDB.formatDepositRequestStatusKey(depositRequest);
    await this.redis.set(key, status.toString());
  }

  async getDepositRequestStatus(
    depositRequest: DepositRequest
  ): Promise<DepositRequestStatus | undefined> {
    const key = DepositScreenerDB.formatDepositRequestStatusKey(depositRequest);
    const val = await this.redis.get(key);
    return val ? (val as DepositRequestStatus) : undefined;
  }

  async setDepositAmountForAddress(
    address: string,
    amount: number
  ): Promise<void> {
    const key = DepositScreenerDB.formatPerAddressDepositAmountKey(address);
    await this.redis.set(key, amount);
  }

  async getDepositAmountForAddress(address: string): Promise<number> {
    const key = DepositScreenerDB.formatPerAddressDepositAmountKey(address);
    const val = await this.redis.get(key);
    return val ? Number(val) : 0;
  }

  async setGlobalDepositAmount(amount: number): Promise<void> {
    await this.redis.set(GLOBAL_DEPOSIT_AMOUNT_KEY, amount);
  }

  async getGlobalDepositAmount(): Promise<number> {
    const val = await this.redis.get(GLOBAL_DEPOSIT_AMOUNT_KEY);
    return val ? Number(val) : 0;
  }
}
