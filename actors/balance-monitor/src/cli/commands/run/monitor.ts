import { Command } from "commander";
import { ethers } from "ethers";
import { makeLogger } from "@nocturne-xyz/offchain-utils";
import { loadNocturneConfig } from "@nocturne-xyz/config";
import { BalanceMonitor } from "../../../monitor";

export const runMonitor = new Command("monitor")
  .summary("monitor balance changes")
  .description("Monitor the balance of addresses and pipe metrics")
  .requiredOption(
    "--config-name <string>",
    "name of the Nocturne contract JSON config file"
  )
  .requiredOption("--bundler-address <string>", "address of the bundler")
  .requiredOption("--screener-address <string>", "address of the screener")
  .requiredOption("--updater-address <string>", "address of the updater")
  .requiredOption(
    "--gas-token-ticker <string>",
    "ticker of the gas token to monitor"
  )
  .option(
    "--log-dir <string>",
    "directory to write logs to. if not given, logs will only be emitted to stdout."
  )
  .option("--log-level <string>", "min log importance to log to stdout.")
  .action(async (options) => {
    const {
      configName,
      bundlerAddress,
      screenerAddress,
      updaterAddress,
      gasTokenTicker,
      logDir,
      logLevel,
    } = options;

    const logger = makeLogger(
      configName,
      "balance-monitor",
      "monitor",
      logLevel,
      logDir
    );

    // Logging configuration details (ensure no sensitive information is logged)
    logger.info("Starting balance monitor with configuration:", {
      configName,
      bundlerAddress,
      screenerAddress,
      updaterAddress,
      gasTokenTicker,
    });

    // Setup of the Ethereum provider
    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) {
      throw new Error("missing RPC_URL");
    }
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

    const config = loadNocturneConfig(configName);

    const balanceMonitor = new BalanceMonitor(
      config,
      provider,
      {
        bundler: bundlerAddress,
        screener: screenerAddress,
        updater: updaterAddress,
      },
      gasTokenTicker,
      logger
    );

    const { promise } = balanceMonitor.start();
    await promise;
  });

export default runMonitor;
