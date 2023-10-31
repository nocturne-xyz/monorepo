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

  // NOTE: the skip owners check flag is set to TRUE because ownership transfer is 2-step and
  // cannot have happened by end of deploy script
  console.log("Checking deployment...");
  await checkNocturneDeployment(deployConfig, config, provider, {
    skipOwnersCheck: true,
  });
  console.log("Checks passed!");

  if (!fs.existsSync(DEPLOYS_DIR)) {
    fs.mkdirSync(DEPLOYS_DIR);
  }
  if (!fs.existsSync(VERIFICATIONS_DIR)) {
    fs.mkdirSync(VERIFICATIONS_DIR);
  }

  const date = Date.now().toString();

  const configFile = `${DEPLOYS_DIR}/${configName}-${date}.json`;
  console.log(`Writing config file to ${configFile}`);
  fs.writeFileSync(configFile, config.toString(), {
    encoding: "utf8",
    flag: "w",
  });

  const verificationFile = `${VERIFICATIONS_DIR}/${configName}-${date}.json`;
  console.log(`Writing verification file to ${verificationFile}`);
  fs.writeFileSync(verificationFile, verification.toString(), {
    encoding: "utf8",
    flag: "w",
  });

  process.exit(0);
})();
