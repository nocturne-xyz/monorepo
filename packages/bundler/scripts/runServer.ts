import { assert } from "console";
import { BundlerServer } from "../src/server";
import * as dotenv from "dotenv";

(async () => {
  dotenv.config();

  const providingWalletAddress = process.argv[2] == "--walletAddress";
  assert(providingWalletAddress);
  const walletAddress = process.argv[3];

  const server = new BundlerServer(walletAddress);
  await server.run(3000);
})();
