import { Address } from "@nocturne-xyz/core";
import { ethers } from "ethers";

export const ACTOR_NAME = "balance-monitor";

export type ActorToCheck =
  | "BalanceMonitor"
  | "Bundler"
  | "SubtreeUpdater"
  | "DepositScreener";

export interface ActorAddresses {
  bundler: Address;
  updater: Address;
  screener: Address;
}

export interface BalanceThresholdInfo {
  address: Address;
  minBalance: bigint;
  targetBalance: bigint;
}

export const BALANCE_THRESHOLDS = (
  balanceMonitorAddress: Address,
  actorAddresses: ActorAddresses
): Map<ActorToCheck, BalanceThresholdInfo> => {
  return new Map<ActorToCheck, BalanceThresholdInfo>([
    [
      "BalanceMonitor",
      {
        address: balanceMonitorAddress,
        minBalance: ethers.utils.parseEther("1.0").toBigInt(),
        targetBalance: ethers.utils.parseEther("2.0").toBigInt(),
      },
    ],
    [
      "Bundler",
      {
        address: actorAddresses.bundler,
        minBalance: ethers.utils.parseEther("0.8").toBigInt(),
        targetBalance: ethers.utils.parseEther("1.4").toBigInt(),
      },
    ],
    [
      "SubtreeUpdater",
      {
        address: actorAddresses.updater,
        minBalance: ethers.utils.parseEther("0.2").toBigInt(),
        targetBalance: ethers.utils.parseEther("0.8").toBigInt(),
      },
    ],
    [
      "DepositScreener",
      {
        address: actorAddresses.screener,
        minBalance: ethers.utils.parseEther("0.4").toBigInt(),
        targetBalance: ethers.utils.parseEther("0.5").toBigInt(),
      },
    ],
  ]);
};
