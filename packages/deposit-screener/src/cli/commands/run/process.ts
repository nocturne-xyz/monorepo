import { Command } from "commander";
import { DepositScreenerProcessor } from "../../../processor";
import { DepositScreenerSubmitter } from "../../../submitter";

const runProcess = new Command("process")
  .summary("Process deposit requests")
  .description(
    "Must supply .env file with REDIS_URL, RPC_URL, TX_SIGNER_KEY, and SUBGRAPH_ENDPOINT. Must supply deposit manager contract address as options."
  )
  .requiredOption(
    "--deposit-manager-address <string>",
    "deposit manager contract address"
  )
  .action(async (options) => {
    const { depositManagerAddress } = options;

    const processor = new DepositScreenerProcessor(depositManagerAddress);
    const submitter = new DepositScreenerSubmitter(depositManagerAddress);

    await Promise.all([processor.run(), submitter.run()]);
  });

export default runProcess;
