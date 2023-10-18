import {
  Erc20Config,
  NocturneConfig,
  loadNocturneConfig,
} from "@nocturne-xyz/config";
import ERC20_ABI from "./abis/erc20.json";
import { Address } from "@nocturne-xyz/core";
import * as ethers from "ethers";
import * as ot from "@opentelemetry/api";
import {
  makeCreateHistogramFn,
  setupDefaultInstrumentation,
} from "@nocturne-xyz/offchain-utils";

const ACTOR_NAME = "balance_cron_job";
const COMPONENT_NAME = "balance_cron_job";

interface GasTokenInfo {
  config: Erc20Config;

  // [numerator, denominator]
  // TODO: make this dollar-denominated and use an API to get current price
  exchangeRateToEth: [bigint, bigint];
}

interface ActorAddrs {
  bundler: Address;
  updater: Address;
  screener: Address;
}

interface BalanceMonitorMetrics {
  bundlerEffectiveEthBalanceHistogram: ot.Histogram;
  screenerEffectiveEthBalanceHistogram: ot.Histogram;
  flush: () => Promise<void>;
}

console.log("otlp endoint:", process.env.OTEL_EXPORTER_OTLP_ENDPOINT);

export async function main() {
  const { bundler, updater, screener } = getAddrs();
  const provider = getProvider();
  const config = getConfig();
  const gasTokens = getGasTokens(config);

  // effective balance of bundler is balance of bundler + balance of updater
  // because we expect bundler gas compensation to pay for updater gas
  let bundlerEffectiveWeiBalance = 0n;

  // get bundler balance in gas tokens and convert to ETH
  for (const [token, { config, exchangeRateToEth }] of gasTokens.entries()) {
    const contract = new ethers.Contract(config.address, ERC20_ABI, provider);

    const bundlerBalance = await contract.balanceOf(bundler);

    console.log(`bundler ${bundler} has ${bundlerBalance} ${token}`);

    const [exchangeRateNum, exchangeRateDenom] = exchangeRateToEth;
    bundlerEffectiveWeiBalance +=
      (bundlerBalance.toBigInt() * exchangeRateNum) / exchangeRateDenom;
  }

  // get updater and screener balance in ETH
  const [updaterBalance, screenerBalanceWei] = await Promise.all([
    provider.getBalance(updater),
    provider.getBalance(screener),
  ]);

  // add updater balance to effective bundler balance
  bundlerEffectiveWeiBalance += updaterBalance.toBigInt();

  // record effective balances
  const bundlerEffectiveEthBalance = parseFloat(
    ethers.utils.formatEther(bundlerEffectiveWeiBalance)
  );
  const screenerEffectiveEthBalance = parseFloat(
    ethers.utils.formatEther(screenerBalanceWei.toBigInt())
  );

  console.log(
    `bundler ${bundler}'s effective balance is ${bundlerEffectiveEthBalance} ETH`
  );
  console.log(
    `screener ${screener}'s effective balance is ${screenerEffectiveEthBalance} ETH`
  );

  const {
    bundlerEffectiveEthBalanceHistogram,
    screenerEffectiveEthBalanceHistogram,
    flush,
  } = await getHistograms();
  bundlerEffectiveEthBalanceHistogram.record(bundlerEffectiveEthBalance);
  screenerEffectiveEthBalanceHistogram.record(screenerEffectiveEthBalance);

  await flush();
}

function getAddrs(): ActorAddrs {
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

function getProvider(): ethers.providers.Provider {
  if (!process.env.RPC_URL) {
    throw new Error("missing RPC_URL environment variable");
  }

  return new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
}

function getConfig(): NocturneConfig {
  if (!process.env.CONFIG_NAME) {
    throw new Error("missing CONFIG_NAME environment variable");
  }

  return loadNocturneConfig(process.env.CONFIG_NAME);
}

function getGasTokens(config: NocturneConfig): Map<string, GasTokenInfo> {
  if (!process.env.GAS_TOKEN_TICKERS) {
    throw new Error("missing GAS_TOKEN_TICKERS environment variable");
  }

  const GAS_TOKEN_TICKERS = process.env.GAS_TOKEN_TICKERS.replace(
    /\s/g,
    ""
  ).split(",");
  if (!GAS_TOKEN_TICKERS.every((ticker) => ticker.length > 0)) {
    throw new Error(
      'GAS_TOKEN_TICKERS must be a comma-separated list of non-empty strings, e.g. "weth, dai, usdc"'
    );
  }

  return new Map(
    GAS_TOKEN_TICKERS.map((ticker) => {
      const c = config.erc20(ticker);
      if (!c) {
        throw new Error(`missing config for ${ticker}`);
      }

      return [
        ticker,
        {
          config: c,

          // TODO get exchange rates from an API
          exchangeRateToEth: [1n, 1n] as [bigint, bigint],
        },
      ];
    })
  );
}

async function getHistograms(): Promise<BalanceMonitorMetrics> {
  const meterProvider = setupDefaultInstrumentation(ACTOR_NAME);
  const meter = ot.metrics.getMeter(COMPONENT_NAME);
  const createHistogram = makeCreateHistogramFn(
    meter,
    ACTOR_NAME,
    COMPONENT_NAME
  );

  return {
    bundlerEffectiveEthBalanceHistogram: createHistogram(
      "bundler_effective_eth_balance",
      "effective ETH balance of bundler",
      "ETH"
    ),
    screenerEffectiveEthBalanceHistogram: createHistogram(
      "screener_effective_eth_balance",
      "effective ETH balance of screener",
      "ETH"
    ),
    flush: async () => meterProvider.forceFlush(),
  };
}
