import { makeLogger } from "@nocturne-xyz/offchain-utils";
import { Command } from "commander";
import {
  EtherscanErc20Transfer,
  getEtherscanErc20Transfers,
  getEtherscanInternalTxs,
} from "./helpers/etherscan";
import {
  etherscanErc20ToTrmRequest,
  etherscanInternalToTrmRequest,
} from "./helpers/utils";
import * as JSON from "bigint-json-serialization";

/**
 * Example
 * yarn deposit-screener-cli inspect trmTxMonitor --token-address 0x6b175474e89094c44da98b954eedeac495271d0f --eth-transfer-style indirect --from-address 0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b --start-block 0 --end-block 27025780 --stdout-log-level=info
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
    "--token-address <string>",
    "address of token to monitor outflows for"
  )
  .option(
    "--eth-transfer-style <string>",
    'whether or not the eth outflows are from top-level transactions or internal transactions ("direct" | "internal" | "both")'
  )
  .option(
    "--from-address <string>",
    "address of the contract to check outflows from"
  )
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
  const {
    tokenAddress,
    ethTransferStyle,
    fromAddress,
    startBlock,
    endBlock,
    logDir,
    stdoutLogLevel,
  } = options;

  const logger = makeLogger(
    logDir,
    "address-checker",
    "checker",
    stdoutLogLevel
  );

  let erc20Outflows: EtherscanErc20Transfer[] = [];
  if (tokenAddress) {
    logger.info(`Checking outflows for token address: ${tokenAddress}`);
    const response = await getEtherscanErc20Transfers(
      tokenAddress,
      fromAddress,
      startBlock,
      endBlock
    );
    erc20Outflows = response.result;
    erc20Outflows.forEach((tx) => {
      logger.info(`ERC-20 outflow: ${JSON.stringify(tx)}`);
    });
  }

  logger.info(`Checking outflows for ETH`);
  let ethOutflowsProms = [];
  if (ethTransferStyle == "direct") {
    throw new Error("not implemented yet");
  } else if (ethTransferStyle == "internal") {
    ethOutflowsProms.push(
      getEtherscanInternalTxs(fromAddress, startBlock, endBlock)
    );
  } else if (ethTransferStyle == "both") {
    throw new Error("not implemented yet");
  } else {
    throw new Error(`Invalid eth transfer style: ${ethTransferStyle}`);
  }

  const ethOutflows = (await Promise.all(ethOutflowsProms))
    .map((response) => response.result)
    .flat();
  ethOutflows.forEach((outflow) => {
    logger.info(`ETH outflow: ${JSON.stringify(outflow)}`);
  });

  const trmErc20Requests = etherscanErc20ToTrmRequest(erc20Outflows);
  for (const trmRequest of trmErc20Requests) {
    logger.info(`TRM ERC-20 request: ${JSON.stringify(trmRequest)}`);
  }

  const trmEthRequests = etherscanInternalToTrmRequest(ethOutflows);
  for (const trmRequest of trmEthRequests) {
    logger.info(`TRM ETH request: ${JSON.stringify(trmRequest)}`);
  }
}

export default runTrmTxMonitor;
