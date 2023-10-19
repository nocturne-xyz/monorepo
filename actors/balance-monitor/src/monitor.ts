import { loadNocturneConfig } from "@nocturne-xyz/config";
import { Address } from "@nocturne-xyz/core";
import * as ethers from "ethers";
import * as ot from "@opentelemetry/api";
import {
  makeCreateObservableGaugeFn,
  makeLogger,
  setupDefaultInstrumentation,
} from "@nocturne-xyz/offchain-utils";
import ERC20_ABI from "./abis/ERC20.json";
import { Logger } from "winston";

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
  private provider: ethers.providers.JsonRpcProvider;
  private actorAddresses: ActorAddresses;
  private gasToken: ethers.Contract;
  private logger: Logger;
  private isMonitoring: boolean = false;

  constructor() {
    const configName = process.env.CONFIG_NAME;
    if (!configName) {
      throw new Error("missing CONFIG_NAME environment variable");
    }
    this.logger = makeLogger(
      "logs",
      `${configName}-balance-monitor`,
      "monitor",
      process.env.STDOUT_LOG_LEVEL ?? "info"
    );

    if (!process.env.RPC_URL) {
      throw new Error("missing RPC_URL environment variable");
    }
    this.provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);

    this.actorAddresses = this.getActorAddresses();
    this.gasToken = this.getGasToken(this.provider);
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

  private getGasToken(
    provider: ethers.providers.JsonRpcProvider
  ): ethers.Contract {
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

    return new ethers.Contract(gasTokenAddress, ERC20_ABI, provider);
  }

  private registerMetrics(): BalanceMonitorMetrics {
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
        this.logger.info("bundler ETH balance ether", balanceEther);
        observableResult.observe(balanceEther);
      } catch (e) {
        this.logger.error("error fetching bundler ETH balance", e);
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
        this.logger.info("bundler gas token balance ether", balanceEther);
        observableResult.observe(balanceEther);
      } catch (e) {
        this.logger.error("error fetching bundler gas token balance", e);
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
        this.logger.info("updater ETH balance", balanceEther);
        observableResult.observe(balanceEther);
      } catch (e) {
        this.logger.error("error fetching updater ETH balance", e);
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
        this.logger.info("screener ETH balance", balanceEther);
        observableResult.observe(balanceEther);
      } catch (e) {
        this.logger.error("error fetching screener ETH balance", e);
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

    console.log(
      "Balance Monitor started. Piping balance metrics every 30 seconds"
    );
    this.registerMetrics();
    while (this.isMonitoring) {
      await new Promise((resolve) => setTimeout(resolve, 60_000)); // Sleep for 60 seconds
    }
  }

  public stop(): void {
    this.isMonitoring = false;
  }
}
