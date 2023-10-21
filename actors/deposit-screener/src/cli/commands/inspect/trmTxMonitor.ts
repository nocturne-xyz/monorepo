import { makeLogger } from "@nocturne-xyz/offchain-utils";
import { Command } from "commander";
import * as JSON from "bigint-json-serialization";
import { getEtherscanErc20Transfers } from "./helpers/etherscan";

/**
 * Example
 * yarn deposit-screener-cli inspect check --snapshot-json-path ./snapshot/addresses.json --output-dir output --stdout-log-level=info
 */
const runTrmTxMonitor = new Command("trmTxMonitor")
  .summary(
    "query token/ETH outflows and submit to TRM transaction monitoring API"
  )
  .description(
    "fetches ERC-20 and ETH outflows from Handler and ETHTransferAdapter, submits details to TRM"
  )
  .requiredOption("--start-block <number>", "start block number")
  .requiredOption("--end-block <number>", "end block number")
  .option(
    "--log-dir <string>",
    "directory to write logs to",
    "./logs/address-checker"
  )
  .option(
    "--stdout-log-level <string>",
    "min log importance to log to stdout. if not given, logs will not be emitted to stdout"
  )
  .action(main);

async function main(options: any): Promise<void> {
  const { startBlock, endBlock, logDir, stdoutLogLevel } = options;

  const logger = makeLogger(
    logDir,
    "address-checker",
    "checker",
    stdoutLogLevel
  );

  const erc20Outflows = await getEtherscanErc20Transfers(
    "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b",
    startBlock,
    endBlock
  );

  logger.info(`ERC-20 outflows: ${JSON.stringify(erc20Outflows)}`);
}

export default runTrmTxMonitor;
