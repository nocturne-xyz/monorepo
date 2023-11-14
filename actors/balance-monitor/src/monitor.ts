import { NocturneConfig } from "@nocturne-xyz/config";
import { Address } from "@nocturne-xyz/core";
import {
  ActorHandle,
  makeCreateObservableGaugeFn,
  setupDefaultInstrumentation,
} from "@nocturne-xyz/offchain-utils";
import * as ot from "@opentelemetry/api";
import * as ethers from "ethers";
import { Logger } from "winston";
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
  private provider: ethers.providers.JsonRpcProvider;
  private actorAddresses: ActorAddresses;
  private gasToken: ethers.Contract;
  private logger: Logger;
  private closed = false;

  constructor(
    config: NocturneConfig,
    provider: ethers.providers.JsonRpcProvider,
    actorAddresses: ActorAddresses,
    gasTokenTicker: string,
    logger: Logger
  ) {
    this.logger = logger;
    this.provider = provider;
    this.actorAddresses = actorAddresses;

    const gasTokenAddress = config.erc20s.get(gasTokenTicker)!.address;
    this.gasToken = new ethers.Contract(gasTokenAddress, ERC20_ABI, provider);
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
        this.logger.info("bundler ETH balance ether", { balanceEther });
        observableResult.observe(balanceEther);
      } catch (e) {
        this.logger.error("error fetching bundler ETH balance", { e });
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
        this.logger.info("bundler gas token balance ether", { balanceEther });
        observableResult.observe(balanceEther);
      } catch (e) {
        this.logger.error("error fetching bundler gas token balance", { e });
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
        this.logger.info("updater ETH balance", { balanceEther });
        observableResult.observe(balanceEther);
      } catch (e) {
        this.logger.error("error fetching updater ETH balance", { e });
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
        this.logger.info("screener ETH balance", { balanceEther });
        observableResult.observe(balanceEther);
      } catch (e) {
        this.logger.error("error fetching screener ETH balance", { e });
      }
    });

    return {
      bundlerEthBalanceGauge,
      bundlerGasTokenBalanceGauge,
      updaterEthBalanceGauge,
      screenerEthBalanceGauge,
    };
  }

  public start(): ActorHandle {
    this.logger.info(
      "Balance Monitor started. Piping balance metrics every 60 seconds."
    );
    this.registerMetrics();

    const promise = new Promise<void>((resolve) => {
      const checkBalanceAndReport = async () => {
        if (this.closed) {
          this.logger.info("Balance Monitor stopping...");
          resolve();
          return;
        }

        setTimeout(checkBalanceAndReport, 60_000);
      };

      void checkBalanceAndReport();
    });

    return {
      promise,
      teardown: async () => {
        this.closed = true;
        await promise;
        this.logger.info("Balance Monitor teardown complete");
      },
    };
  }
}
