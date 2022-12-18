import { assert } from "console";
import { BundlerSubmitter } from "../src/submitter";
import * as dotenv from "dotenv";

(async () => {
  dotenv.config();

  const providingWalletAddress = process.argv[2] == "--walletAddress";
  assert(providingWalletAddress);
  const walletAddress = process.argv[3];

  const server = new BundlerSubmitter(walletAddress);
  await server.run();
})();
