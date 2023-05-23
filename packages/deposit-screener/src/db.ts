import {
  DepositRequest,
  DepositRequestStatus,
  hashDepositRequest,
} from "@nocturne-xyz/sdk";
import IORedis from "ioredis";
import * as JSON from "bigint-json-serialization";

const NEXT_BLOCK_KEY = "NEXT_BLOCK";

const DEPOSIT_REQUEST_PREFIX = "DEPOSIT_REQUEST_";
const DEPOSIT_REQUEST_STATUS_PREFIX = "DEPOSIT_REQUEST_STATUS_";
const PER_ADDR_DEPOSIT_AMOUNT_PREFIX = "PER_ADDR_DEPOSIT_AMOUNT_";

const GLOBAL_DEPOSIT_AMOUNT_KEY = "GLOBAL_DEPOSIT_AMOUNT";

export class DepositScreenerDB {
  redis: IORedis;

  constructor(redis: IORedis) {
    this.redis = redis;
  }

  private static formatDepositRequestKey(
    depositRequestOrHash: DepositRequest | string
  ): string {
    if (typeof depositRequestOrHash !== "string") {
      depositRequestOrHash = hashDepositRequest(depositRequestOrHash);
    }
    return DEPOSIT_REQUEST_PREFIX + depositRequestOrHash;
  }

  private static formatDepositRequestStatusKey(
    depositRequestOrHash: DepositRequest | string
  ): string {
    if (typeof depositRequestOrHash !== "string") {
      depositRequestOrHash = hashDepositRequest(depositRequestOrHash);
    }
    return DEPOSIT_REQUEST_STATUS_PREFIX + depositRequestOrHash;
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

  async storeDepositRequest(depositRequest: DepositRequest): Promise<void> {
    const key = DepositScreenerDB.formatDepositRequestKey(depositRequest);
    await this.redis.set(key, JSON.stringify(depositRequest));
  }

  async getDepositRequest(
    depositHash: string
  ): Promise<DepositRequest | undefined> {
    const key = DepositScreenerDB.formatDepositRequestKey(depositHash);
    const val = await this.redis.get(key);
    if (!val) {
      return undefined;
    }
    return JSON.parse(val) as DepositRequest;
  }

  async setDepositRequestStatus(
    depositRequestOrHash: DepositRequest | string,
    status: DepositRequestStatus
  ): Promise<void> {
    const key =
      DepositScreenerDB.formatDepositRequestStatusKey(depositRequestOrHash);
    await this.redis.set(key, status.toString());
  }

  async getDepositRequestStatus(
    depositRequestOrHash: DepositRequest | string
  ): Promise<DepositRequestStatus | undefined> {
    const key =
      DepositScreenerDB.formatDepositRequestStatusKey(depositRequestOrHash);
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
