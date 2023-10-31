import dotenv from "dotenv";
import { ethers } from "ethers";
import { checkNocturneDeployment } from "../src/checks";
import { loadNocturneConfig } from "@nocturne-xyz/config";

dotenv.config();

(async () => {
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) throw new Error("Missing RPC_URL");

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

  const configPath = process.env.CONFIG_PATH;
  if (!configPath) throw new Error("Missing CONFIG_PATH");

  const config = loadNocturneConfig(configPath);

  // NOTE: the skip owners check flag is NOT passed in so it assumes 2-step ownership transfer
  // has been completed
  console.log("Checking deployment...");
  await checkNocturneDeployment(config, provider);
  console.log("Checks passed!");
})();
