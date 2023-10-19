import { loadNocturneConfig } from "@nocturne-xyz/config";
import { Address } from "@nocturne-xyz/core";
import * as ethers from "ethers";
import * as ot from "@opentelemetry/api";
import {
  makeCreateObservableGaugeFn,
  setupDefaultInstrumentation,
} from "@nocturne-xyz/offchain-utils";
import ERC20_ABI from "./abis/ERC20.json";

const ACTOR_NAME = "balance-monitor";
const COMPONENT_NAME = "monitor";

interface ActorAddresses {
  bundler: Address;
  updater: Address;
  screener: Address;
}

interface BalanceMonitorMetrics {
  bundlerEthBalanceGauge: ot.ObservableGauge;
  bundlerGasTokenBalanceGauge: ot.ObservableGauge;
  updaterEthBalanceGauge: ot.ObservableGauge;
  screenerEthBalanceGauge: ot.ObservableGauge;
}

export class BalanceMonitor {
  private provider: ethers.providers.Provider;
  private actorAddresses: ActorAddresses;
  private gasToken: ethers.Contract;
  private metrics: BalanceMonitorMetrics;
  private isMonitoring: boolean = false;

  constructor() {
    this.actorAddresses = this.getActorAddresses();
    this.provider = this.getProvider();
    this.gasToken = this.getGasToken();
    this.metrics = this.getAndRegisterMetrics();
  }

  private getGasToken(): ethers.Contract {
    if (!process.env.CONFIG_NAME) {
      throw new Error("missing CONFIG_NAME environment variable");
    }
    const config = loadNocturneConfig(process.env.CONFIG_NAME);

    if (!process.env.GAS_TOKEN_TICKER) {
      throw new Error("missing GAS_TOKEN_TICKER environment variable");
    }
    const gasTokenAddress = config.erc20s.get(
      process.env.GAS_TOKEN_TICKER
    )!.address;

    return new ethers.Contract(gasTokenAddress, ERC20_ABI);
  }

  private getActorAddresses(): ActorAddresses {
    // Logic for getAddrs function
    if (!process.env.BUNDLER_ADDRESS) {
      throw new Error("missing BUNDLER_ADDRESS environment variable");
    }
    if (!process.env.UPDATER_ADDRESS) {
      throw new Error("missing UPDATER_ADDRESS environment variable");
    }
    if (!process.env.SCREENER_ADDRESS) {
      throw new Error("missing SCREENER_ADDRESS environment variable");
    }

    return {
      bundler: ethers.utils.getAddress(process.env.BUNDLER_ADDRESS),
      updater: ethers.utils.getAddress(process.env.UPDATER_ADDRESS),
      screener: ethers.utils.getAddress(process.env.SCREENER_ADDRESS),
    };
  }

  private getProvider(): ethers.providers.Provider {
    // Logic for getProvider function
    if (!process.env.RPC_URL) {
      throw new Error("missing RPC_URL environment variable");
    }
    return new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
  }

  private getAndRegisterMetrics(): BalanceMonitorMetrics {
    // Metrics default setup exports every 30s
    setupDefaultInstrumentation(ACTOR_NAME);
    const meter = ot.metrics.getMeter(COMPONENT_NAME);
    const createObservableGauge = makeCreateObservableGaugeFn(
      meter,
      ACTOR_NAME,
      COMPONENT_NAME
    );

    const bundlerEthBalanceGauge = createObservableGauge(
      "bundler_eth_balance",
      "ETH balance of bundler",
      "ETH"
    );
    const bundlerGasTokenBalanceGauge = createObservableGauge(
      "bundler_gas_token_balance",
      "gas token balance of bundler",
      "gas token"
    );
    const updaterEthBalanceGauge = createObservableGauge(
      "updater_eth_balance",
      "ETH balance of updater",
      "ETH"
    );
    const screenerEthBalanceGauge = createObservableGauge(
      "screener_eth_balance",
      "ETH balance of screener",
      "ETH"
    );

    bundlerEthBalanceGauge.addCallback(async (observableResult) => {
      try {
        const balance = await this.provider.getBalance(
          this.actorAddresses.bundler
        );
        const balanceEther = parseFloat(
          ethers.utils.formatUnits(balance, "ether")
        );
        console.log("bundler ETH balance ether", balanceEther);
        observableResult.observe(balanceEther);
      } catch (e) {
        console.log("error fetching bundler ETH balance", e);
      }
    });

    bundlerGasTokenBalanceGauge.addCallback(async (observableResult) => {
      try {
        const balance = await this.gasToken.balanceOf(
          this.actorAddresses.bundler
        );
        const balanceEther = parseFloat(
          ethers.utils.formatUnits(balance, "ether")
        );
        console.log("bundler gas token balance ether", balanceEther);
        observableResult.observe(balanceEther);
      } catch (e) {
        console.log("error fetching bundler gas token balance", e);
      }
    });

    updaterEthBalanceGauge.addCallback(async (observableResult) => {
      try {
        const balance = await this.provider.getBalance(
          this.actorAddresses.updater
        );
        const balanceEther = parseFloat(
          ethers.utils.formatUnits(balance, "ether")
        );
        console.log("updater ETH balance", balanceEther);
        observableResult.observe(balanceEther);
      } catch (e) {
        console.log("error fetching updater ETH balance", e);
      }
    });

    screenerEthBalanceGauge.addCallback(async (observableResult) => {
      try {
        const balance = await this.provider.getBalance(
          this.actorAddresses.screener
        );
        const balanceEther = parseFloat(
          ethers.utils.formatUnits(balance, "ether")
        );
        console.log("screener ETH balance", balanceEther);
        observableResult.observe(balanceEther);
      } catch (e) {
        console.log("error fetching screener ETH balance", e);
      }
    });

    return {
      bundlerEthBalanceGauge,
      bundlerGasTokenBalanceGauge,
      updaterEthBalanceGauge,
      screenerEthBalanceGauge,
    };
  }

  public async start(): Promise<void> {
    this.isMonitoring = true;
    this.metrics;

    console.log(
      "Balance Monitor started. Piping balance metrics every 30 seconds"
    );
    while (this.isMonitoring) {
      await new Promise((resolve) => setTimeout(resolve, 60_000)); // Sleep for 60 seconds
    }
  }

  public stop(): void {
    this.isMonitoring = false;
  }
}
