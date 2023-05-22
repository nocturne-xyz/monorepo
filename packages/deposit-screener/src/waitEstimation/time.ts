import { Job } from "bullmq";
import { DepositRequestJobData } from "../types";
import { Address } from "@nocturne-xyz/sdk";

const SECS_IN_HOUR = 60 * 60;

export function calculateTimeLeftInJobDelaySeconds(
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

  // Must do fraction-preserving div using numbers
  const waitHours = Number(totalValue) / Number(rateLimit);
  return Math.ceil(waitHours * SECS_IN_HOUR);
}
