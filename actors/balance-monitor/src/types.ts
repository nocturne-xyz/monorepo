import { Address } from "@nocturne-xyz/core";
import { ethers } from "ethers";

export const ACTOR_NAME = "balance-monitor";

export interface ActorAddresses {
  bundler: Address;
  updater: Address;
  screener: Address;
}

export const BALANCE_THRESHOLDS = {
  BalanceMonitor: {
    minBalance: ethers.utils.parseEther("1.0").toBigInt(),
    targetBalance: ethers.utils.parseEther("2.0").toBigInt(),
  },
  Bundler: {
    minBalance: ethers.utils.parseEther("0.4").toBigInt(),
    targetBalance: ethers.utils.parseEther("0.8").toBigInt(),
  },
  SubtreeUpdater: {
    minBalance: ethers.utils.parseEther("0.2").toBigInt(),
    targetBalance: ethers.utils.parseEther("0.8").toBigInt(),
  },
  DepositScreener: {
    minBalance: ethers.utils.parseEther("0.2").toBigInt(),
    targetBalance: ethers.utils.parseEther("0.5").toBigInt(),
  },
};
