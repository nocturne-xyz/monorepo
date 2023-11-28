import { NocturneConfig } from "@nocturne-xyz/config";
import {
  ActorHandle,
  makeCreateObservableGaugeFn,
  setupDefaultInstrumentation,
} from "@nocturne-xyz/offchain-utils";
import * as ot from "@opentelemetry/api";
import * as ethers from "ethers";
import { Logger } from "winston";
import ERC20_ABI from "./abis/ERC20.json";
import {
  ACTOR_NAME,
  BALANCE_THRESHOLDS,
  ActorAddresses,
  BalanceThresholdInfo,
  ActorToCheck,
} from "./types";

const COMPONENT_NAME = "monitor";

interface BalanceMonitorMetrics {
  bundlerEthBalanceGauge: ot.ObservableGauge;
  bundlerGasTokenBalanceGauge: ot.ObservableGauge;
  updaterEthBalanceGauge: ot.ObservableGauge;
  screenerEthBalanceGauge: ot.ObservableGauge;
}

export class BalanceMonitor {
  private wallet: ethers.Wallet;
  private actorAddresses: ActorAddresses;
  private balanceThresholdInfo: Map<ActorToCheck, BalanceThresholdInfo>;
  private gasToken: ethers.Contract;
  private logger: Logger;
  private closed = false;

  constructor(
    config: NocturneConfig,
    wallet: ethers.Wallet,
    actorAddresses: ActorAddresses,
    gasTokenTicker: string,
    logger: Logger
  ) {
    this.wallet = wallet;
    this.logger = logger;
    this.actorAddresses = actorAddresses;

    this.balanceThresholdInfo = BALANCE_THRESHOLDS(
      this.wallet.address,
      actorAddresses
    );

    const gasTokenAddress = config.erc20s.get(gasTokenTicker)!.address;

    this.logger.info(`gas token address ${gasTokenAddress}`);
    this.gasToken = new ethers.Contract(gasTokenAddress, ERC20_ABI, wallet);
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
        const balance = await this.wallet.provider.getBalance(
          this.actorAddresses.bundler
        );
        const balanceEther = parseFloat(
          ethers.utils.formatUnits(balance, "ether")
        );
        this.logger.info(`bundler ETH balance ether ${balanceEther}`);
        observableResult.observe(balanceEther);
      } catch (error) {
        this.logger.error("error fetching bundler ETH balance", { error });
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
        this.logger.info(`bundler gas token balance ether ${balanceEther}`);
        observableResult.observe(balanceEther);
      } catch (error) {
        this.logger.error("error fetching bundler gas token balance", {
          error,
        });
      }
    });

    updaterEthBalanceGauge.addCallback(async (observableResult) => {
      try {
        const balance = await this.wallet.provider.getBalance(
          this.actorAddresses.updater
        );
        const balanceEther = parseFloat(
          ethers.utils.formatUnits(balance, "ether")
        );
        this.logger.info(`updater ETH balance ${balanceEther}`);
        observableResult.observe(balanceEther);
      } catch (error) {
        this.logger.error("error fetching updater ETH balance", { error });
      }
    });

    screenerEthBalanceGauge.addCallback(async (observableResult) => {
      try {
        const balance = await this.wallet.provider.getBalance(
          this.actorAddresses.screener
        );
        const balanceEther = parseFloat(
          ethers.utils.formatUnits(balance, "ether")
        );
        this.logger.info(`screener ETH balance ${balanceEther}`);
        observableResult.observe(balanceEther);
      } catch (error) {
        this.logger.error("error fetching screener ETH balance", { error });
      }
    });

    return {
      bundlerEthBalanceGauge,
      bundlerGasTokenBalanceGauge,
      updaterEthBalanceGauge,
      screenerEthBalanceGauge,
    };
  }

  private async tryFillBalances(): Promise<void> {
    try {
      for (const [actor, info] of this.balanceThresholdInfo.entries()) {
        const ethBalance = (
          await this.wallet.provider.getBalance(info.address)
        ).toBigInt();

        this.logger.info(`current ${actor} ETH balance: ${ethBalance}`);
        if (ethBalance < info.minBalance) {
          if (actor === "BalanceMonitor") {
            // Log errors so alerts are triggered and team can top up balance monitor wallet
            if (ethBalance < info.minBalance) {
              this.logger.error(
                `need to top up balance monitor! current balance: ${ethBalance}. min balance: ${info.minBalance}`
              );
            }
          } else {
            // Top up actor if not balance monitor
            const diff = info.targetBalance - ethBalance;

            this.logger.info(`topping up ${actor} balance. amount: ${diff}`);
            const tx = await this.wallet.sendTransaction({
              to: info.address,
              value: diff,
            });
            await tx.wait(1);
          }
        }
      }
    } catch (error) {
      this.logger.error("error filling balances", { error });
    }
  }

  public start(): ActorHandle {
    this.logger.info(
      "Balance Monitor started. Piping balance metrics every 60 seconds."
    );
    this.registerMetrics();

    let timeoutId: NodeJS.Timeout;
    const promise = new Promise<void>((resolve) => {
      const poll = async () => {
        this.logger.info("polling...");

        if (this.closed) {
          this.logger.info("Balance Monitor stopping...");
          clearTimeout(timeoutId);
          resolve();
          return;
        }

        // try to top up balances
        await this.tryFillBalances();

        // balance monitor metrics piping is implicit, automatically executed via register metrics
        // callbacks
        timeoutId = setTimeout(poll, 60_000);
      };

      void poll();
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
