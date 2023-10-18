import { loadNocturneConfig } from "@nocturne-xyz/config";
import { Address } from "@nocturne-xyz/core";
import * as ethers from "ethers";
import * as ot from "@opentelemetry/api";
import {
  makeCreateObservableGaugeFn,
  setupDefaultInstrumentation,
} from "@nocturne-xyz/offchain-utils";
import { WETH9, WETH9__factory } from "@nocturne-xyz/contracts";

const ACTOR_NAME = "balance-monitor";
const COMPONENT_NAME = "monitor";

interface ActorAddresses {
  bundler: Address;
  updater: Address;
  screener: Address;
}

interface BalanceMonitorMetrics {
  bundlerEthBalanceGauge: ot.ObservableGauge;
  bundlerWethBalanceGauge: ot.ObservableGauge;
  updaterEthBalanceGauge: ot.ObservableGauge;
  screenerEthBalanceGauge: ot.ObservableGauge;
}

export class BalanceMonitor {
  private provider: ethers.providers.Provider;
  private actorAddresses: ActorAddresses;
  private weth: WETH9;
  private metrics: BalanceMonitorMetrics;
  private isMonitoring: boolean = false;

  constructor() {
    this.actorAddresses = this.getActorAddresses();
    this.provider = this.getProvider();
    this.metrics = this.getAndRegisterMetrics();
    this.weth = this.getWeth();
  }

  private getWeth(): WETH9 {
    if (!process.env.CONFIG_NAME) {
      throw new Error("missing CONFIG_NAME environment variable");
    }
    const config = loadNocturneConfig(process.env.CONFIG_NAME);
    const wethAddress = config.erc20s.get("WETH")!.address;
    return WETH9__factory.connect(wethAddress, this.provider);
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
    const bundlerWethBalanceGauge = createObservableGauge(
      "bundler_weth_balance",
      "WETH balance of bundler",
      "WETH"
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
      const balance = await this.provider.getBalance(
        this.actorAddresses.bundler
      );
      console.log("bundler ETH balance", balance.toNumber());
      observableResult.observe(balance.toNumber());
    });

    bundlerWethBalanceGauge.addCallback(async (observableResult) => {
      const balance = await this.weth.balanceOf(this.actorAddresses.bundler);
      console.log("bundler WETH balance", balance.toNumber());
      observableResult.observe(balance.toNumber());
    });

    updaterEthBalanceGauge.addCallback(async (observableResult) => {
      const balance = await this.provider.getBalance(
        this.actorAddresses.updater
      );
      console.log("updater ETH balance", balance.toNumber());
      observableResult.observe(balance.toNumber());
    });

    screenerEthBalanceGauge.addCallback(async (observableResult) => {
      const balance = await this.provider.getBalance(
        this.actorAddresses.screener
      );
      console.log("screener ETH balance", balance.toNumber());
      observableResult.observe(balance.toNumber());
    });

    return {
      bundlerEthBalanceGauge,
      bundlerWethBalanceGauge,
      updaterEthBalanceGauge,
      screenerEthBalanceGauge,
    };
  }

  public async start() {
    this.isMonitoring = true;
    this.metrics;

    console.log(
      "Balance Monitor started. Piping balance metrics every 30 seconds"
    );
    while (this.isMonitoring) {
      await new Promise((resolve) => setTimeout(resolve, 60_000)); // Sleep for 60 seconds
    }
  }

  public stop() {
    this.isMonitoring = false;
  }
}
