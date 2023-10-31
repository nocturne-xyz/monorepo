import { ethers } from "ethers";
import { loadDeployConfigFromJSON } from "../src/config";
import { deployNocturne } from "../src/deploy";
import * as dotenv from "dotenv";
import * as fs from "fs";
import { checkNocturneDeployment } from "../src/checks";

const CONFIGS_DIR = `${__dirname}/../configs/`;
const DEPLOYS_DIR = `${__dirname}/../deploys/`;
const VERIFICATIONS_DIR = `${__dirname}/../verifications/`;

dotenv.config();

(async () => {
  const configName = process.env.CONFIG_NAME;
  if (!configName) throw new Error("Missing CONFIG_NAME");

  const deployerKey = process.env.DEPLOYER_KEY;
  if (!deployerKey) throw new Error("Missing DEPLOYER_KEY");

  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) throw new Error("Missing RPC_URL");

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const deployer = new ethers.Wallet(deployerKey, provider);

  const configString = fs.readFileSync(
    `${CONFIGS_DIR}/${configName}.json`,
    "utf-8"
  );
  const deployConfig = loadDeployConfigFromJSON(configString);
  const { config, verification } = await deployNocturne(deployer, deployConfig);
  console.log(config);
  console.log(verification);

  console.log("Checking deployment...");
  await checkNocturneDeployment(config, provider);
  console.log("Checks passed!");

  if (!fs.existsSync(DEPLOYS_DIR)) {
    fs.mkdirSync(DEPLOYS_DIR);
  }
  if (!fs.existsSync(VERIFICATIONS_DIR)) {
    fs.mkdirSync(VERIFICATIONS_DIR);
  }

  const date = Date.now().toString();
  fs.writeFileSync(
    `${DEPLOYS_DIR}/${configName}-${date}.json`,
    config.toString(),
    {
      encoding: "utf8",
      flag: "w",
    }
  );
  fs.writeFileSync(
    `${VERIFICATIONS_DIR}/${configName}-${date}.json`,
    verification.toString(),
    {
      encoding: "utf8",
      flag: "w",
    }
  );

  process.exit(0);
})();
