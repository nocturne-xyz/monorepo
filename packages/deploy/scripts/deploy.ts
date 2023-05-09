import { ethers } from "ethers";
import { loadDeployConfigFromJSON } from "../src/config";
import { deployNocturne } from "../src/deploy";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as JSON from "bigint-json-serialization";
import { checkNocturneDeployment } from "../src/checks";

const CONFIGS_DIR = `${__dirname}/../configs/`;
const DEPLOYS_DIR = `${__dirname}/../deploys/`;

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
  const config = loadDeployConfigFromJSON(configString);

  const nocturneConfig = await deployNocturne(deployer, config);
  console.log(nocturneConfig);

  await checkNocturneDeployment(nocturneConfig, provider);

  if (!fs.existsSync(DEPLOYS_DIR)) {
    fs.mkdirSync(DEPLOYS_DIR);
  }

  fs.writeFileSync(
    `${DEPLOYS_DIR}/${configName}-${Date.now().toString()}.json`,
    JSON.stringify(nocturneConfig),
    {
      encoding: "utf8",
      flag: "w",
    }
  );

  process.exit(0);
})();
