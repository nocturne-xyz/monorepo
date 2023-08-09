import { Job } from "bullmq";
import { DepositRequestJobData } from "../types";
import { Address } from "@nocturne-xyz/wallet-sdk";
import { divideDecimalPreserving } from "../utils";

const SECS_IN_HOUR = 60 * 60;

export function calculateSecondsLeftInJobDelay(
  job: Job<DepositRequestJobData>
): number {
  const jobDelayMs = job.delay;
  const enqueuedDateMs = job.timestamp;

  const delayElapsedMs = Date.now() - enqueuedDateMs;
  const msLeftInDelay = Math.max(jobDelayMs - delayElapsedMs, 0);

  return Math.ceil(msLeftInDelay / 1000);
}

export function convertAssetTotalToDelaySeconds(
  assetAddr: Address,
  totalValue: bigint,
  rateLimits: Map<Address, bigint>
): number {
  const rateLimit = rateLimits.get(assetAddr);
  if (!rateLimit) {
    throw new Error(`No rate limit for asset ${assetAddr}`);
  }

  // NOTE: 3 decimal places is fine because largest possible totalValue = 2^128. Internally,
  // divideDecimalPreserving will multiply totalValue by 10^precision (1000) which has no overflow
  // risk since largest bigint is 2^231 - 1
  const waitHours = divideDecimalPreserving(totalValue, rateLimit, 3);
  return Math.ceil(waitHours * SECS_IN_HOUR);
}
