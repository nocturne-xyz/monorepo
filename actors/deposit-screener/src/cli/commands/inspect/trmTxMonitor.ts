import { makeLogger } from "@nocturne-xyz/offchain-utils";
import { Command } from "commander";
import {
  EtherscanErc20Transfer,
  getEtherscanErc20Transfers,
  getEtherscanInternalEthTransfers,
} from "./helpers/etherscan";
import {
  etherscanErc20ToTrmTransferRequest,
  etherscanInternalEthTransferToTrmTransferRequest,
  getLocalRedis,
} from "./helpers/utils";
import * as JSON from "bigint-json-serialization";
import { submitTrmTransfer } from "./helpers/trm";

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
    "trm-tx-monitor",
    "monitor",
    stdoutLogLevel
  );

  const redis = await getLocalRedis();

  // TODO: generalize to handle multiple tokens
  let erc20Outflows: EtherscanErc20Transfer[] = [];
  if (tokenAddress) {
    logger.info(`Checking outflows for token address: ${tokenAddress}`);
    erc20Outflows = await getEtherscanErc20Transfers(
      tokenAddress,
      fromAddress,
      startBlock,
      endBlock,
      redis
    );
    erc20Outflows.forEach((tx) => {
      logger.info(`ERC-20 outflow: ${JSON.stringify(tx)}`);
    });
  }

  logger.info(`Checking outflows for ETH`);
  let ethOutflowsProms = [];
  if (!ethTransferStyle) {
    logger.info(`No eth transfer style given, skipping eth checks`);
  } else if (ethTransferStyle == "direct") {
    throw new Error("not implemented yet");
  } else if (ethTransferStyle == "internal") {
    ethOutflowsProms.push(
      getEtherscanInternalEthTransfers(fromAddress, startBlock, endBlock, redis)
    );
  } else if (ethTransferStyle == "both") {
    throw new Error("not implemented yet");
  } else {
    throw new Error(`Invalid eth transfer style: ${ethTransferStyle}`);
  }

  const ethOutflows = (await Promise.all(ethOutflowsProms)).flat();
  ethOutflows.forEach((outflow) => {
    logger.info(`ETH outflow: ${JSON.stringify(outflow)}`);
  });

  const trmErc20Requests = await etherscanErc20ToTrmTransferRequest(
    erc20Outflows,
    redis
  );
  for (const trmRequest of trmErc20Requests) {
    logger.info(
      `Submitting ERC-20 transfer to TRM: ${JSON.stringify(trmRequest)}`
    );
    const res = await submitTrmTransfer(trmRequest, redis);
    logger.info(`TRM response: ${JSON.stringify(res)}`);
  }

  const trmEthRequests = await etherscanInternalEthTransferToTrmTransferRequest(
    ethOutflows,
    redis
  );
  for (const trmRequest of trmEthRequests) {
    logger.info(`TRM ETH request: ${JSON.stringify(trmRequest)}`);
    const res = await submitTrmTransfer(trmRequest, redis);
    logger.info(`TRM response: ${JSON.stringify(res)}`);
  }
}

export default runTrmTxMonitor;
