import dotenv from "dotenv";
import { ethers } from "ethers";
import { checkNocturneDeployment } from "../src/checks";
import { loadNocturneConfig } from "@nocturne-xyz/config";
import * as fs from "fs";
import { loadDeployConfigFromJSON } from "../src/config";

dotenv.config();

const DEPLOY_CONFIGS_DIR = `${__dirname}/../configs/`;

(async () => {
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) throw new Error("Missing RPC_URL");

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

  const deployConfigName = process.env.CONFIG_NAME;
  if (!deployConfigName) throw new Error("Missing CONFIG_NAME");

  const configPath = process.env.CONFIG_PATH;
  if (!configPath) throw new Error("Missing CONFIG_PATH");

  const configString = fs.readFileSync(
    `${DEPLOY_CONFIGS_DIR}/${deployConfigName}.json`,
    "utf-8"
  );
  const deployConfig = loadDeployConfigFromJSON(configString);

  const config = loadNocturneConfig(configPath);

  // NOTE: the skip owners check flag is NOT passed in so it assumes 2-step ownership transfer
  // has been completed
  console.log("Checking deployment...");
  await checkNocturneDeployment(deployConfig, config, provider);
  console.log("Checks passed!");
})();
