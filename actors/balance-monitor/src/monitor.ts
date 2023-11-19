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
import { ACTOR_NAME, BALANCE_THRESHOLDS, ActorAddresses } from "./types";

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
      const selfEthBalance = (await this.wallet.getBalance()).toBigInt();

      this.logger.info(`current self ETH balance: ${selfEthBalance}`);
      if (selfEthBalance < BALANCE_THRESHOLDS.BalanceMonitor.minBalance) {
        this.logger.error(
          `balance monitor ETH balance ${selfEthBalance} is below minimum ${BALANCE_THRESHOLDS.BalanceMonitor.minBalance}`
        );
      }

      const bundlerEthBalance = (
        await this.wallet.provider.getBalance(this.actorAddresses.bundler)
      ).toBigInt();

      this.logger.info(`current bundler ETH balance: ${bundlerEthBalance}`);
      this.logger.info(
        `bundler min balance: ${BALANCE_THRESHOLDS.Bundler.minBalance}`
      );
      if (bundlerEthBalance < BALANCE_THRESHOLDS.Bundler.minBalance) {
        const diff =
          BALANCE_THRESHOLDS.Bundler.targetBalance - bundlerEthBalance;

        this.logger.info(`topping up bundler balance. amount: ${diff}`);
        const tx = await this.wallet.sendTransaction({
          to: this.actorAddresses.bundler,
          value: diff,
        });
        await tx.wait(1);
      }

      const updaterEthBalance = (
        await this.wallet.provider.getBalance(this.actorAddresses.updater)
      ).toBigInt();

      this.logger.info(`current updater ETH balance: ${updaterEthBalance}`);
      if (updaterEthBalance < BALANCE_THRESHOLDS.SubtreeUpdater.minBalance) {
        const diff =
          BALANCE_THRESHOLDS.SubtreeUpdater.targetBalance - updaterEthBalance;

        this.logger.info(`topping up updater balance. amount: ${diff}`);
        const tx = await this.wallet.sendTransaction({
          to: this.actorAddresses.updater,
          value: diff,
        });
        await tx.wait(1);
      }

      // Deposit screener
      const screenerEthBalance = (
        await this.wallet.provider.getBalance(this.actorAddresses.screener)
      ).toBigInt();

      this.logger.info(`current screener ETH balance: ${screenerEthBalance}`);
      if (screenerEthBalance < BALANCE_THRESHOLDS.DepositScreener.minBalance) {
        const diff =
          BALANCE_THRESHOLDS.DepositScreener.targetBalance - screenerEthBalance;

        this.logger.info(`topping up screener balance. amount: ${diff}`);
        const tx = await this.wallet.sendTransaction({
          to: this.actorAddresses.screener,
          value: diff,
        });
        await tx.wait(1);
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

    const promise = new Promise<void>((resolve) => {
      const poll = async () => {
        this.logger.info("polling...");

        if (this.closed) {
          this.logger.info("Balance Monitor stopping...");
          resolve();
          return;
        }

        // try to top up balances
        await this.tryFillBalances();

        // balance monitor metrics piping is implicit, automatically executed via register metrics
        // callbacks
        setTimeout(poll, 60_000);
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
