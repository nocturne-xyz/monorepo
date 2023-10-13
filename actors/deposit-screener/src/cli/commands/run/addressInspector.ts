import { makeLogger } from "@nocturne-xyz/offchain-utils";
import { Command } from "commander";
import fs from "fs";
import { requireApiKeys } from "../../../utils";
import { RULESET_V1 } from "../../../screening/checks/v1/RULESET_V1";
import { formDepositInfo } from "../../../../test/utils";
import {
  CachedApiCallData,
  isRejection,
} from "../../../screening/checks/RuleSet";
import path from "path";
import { Logger } from "winston";
import * as crypto from "crypto";
import IORedis from "ioredis";

/**
 * Example
 * npx ts-node src/cli/index.ts run addressInspector --input-csv ./data/addresses.csv --output-data ./data/addresses.json --delay=3 --stdout-log-level=info
 */
const runInspector = new Command("addressInspector")
  .summary("inspect and analyze addresses from a CSV file")
  .description(
    "analyzes a list of addresses, provides acceptance metrics and rejection reasons"
  )
  .requiredOption(
    "--input-csv <path>",
    "path to the CSV file containing addresses to inspect, first column contains the addresses to verify"
  )
  .requiredOption(
    "--output-data <path>",
    "path to the JSON file to write the output data to"
  )
  .option(
    "--log-dir <string>",
    "directory to write logs to",
    "./logs/address-inspector"
  )
  .option(
    "--delay <number>",
    "delay between requests to avoid rate limits (in seconds)",
    "1"
  )
  .option(
    "--stdout-log-level <string>",
    "min log importance to log to stdout. if not given, logs will not be emitted to stdout"
  )
  .option(
    "--data-folder <string>",
    "folder to store data responses corresponding to addresses"
  )
  .action(main);

function showReasonCounts(
  logger: Logger,
  reasonCounts: Record<string, number>
): void {
  // if there are no reasons
  if (Object.keys(reasonCounts).length === 0) {
    logger.info(`No rejections.`);
  }
  const sortedReasonCounts = Object.entries(reasonCounts).sort((a, b) => {
    return b[1] - a[1];
  });
  logger.info(`Sorted reason counts:`);
  for (const reasonCount of sortedReasonCounts) {
    logger.info(`${reasonCount[0]}: ${reasonCount[1]}`);
  }
}

function hashString(s: string): string {
  const hash = crypto.createHash("sha256");
  hash.update(s);
  return hash.digest("hex");
}

async function main(options: any): Promise<void> {
  requireApiKeys();

  const { inputCsv, outputData, logDir, stdoutLogLevel, delay, dataFolder } =
    options;

  const logger = makeLogger(
    logDir,
    "address-inspector",
    "inspector",
    stdoutLogLevel
  );

  if (!fs.existsSync(inputCsv)) {
    throw new Error(`Input file ${inputCsv} does not exist`);
  }

  const delayNumber = Number(delay);
  if (isNaN(delayNumber)) {
    throw new Error(`Delay ${delay} is not a number`);
  }

  // check that the dir where we are going to output to exists using the path library, if not, create it
  const outputDir = path.dirname(outputData);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // check if we can write to the output directory
  try {
    fs.accessSync(outputDir, fs.constants.W_OK);
  } catch (err) {
    throw new Error(`Cannot write to output directory ${outputDir}`);
  }

  const redis = new IORedis({ port: 6380, password: "baka" });
  try {
    // wait for the state to be connected
    let retries = 10;
    while (redis.status !== "ready" && retries-- > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  } catch (err) {
    throw new Error(
      `Cannot connect to redis, from the deposit screener folder try 'docker compose up -d redis' if it is not running. ${err}`
    );
  }

  const ruleset = RULESET_V1(redis);

  logger.info(`Starting inspection for addresses from ${inputCsv}`);
  // read the entire csv input files into memory
  const inputFileText = await fs.promises.readFile(inputCsv, "utf-8");
  // split the input file into lines
  const inputFileLines = inputFileText.split("\n");
  // take the first column
  const addresses = inputFileLines.map((line) => line.split(",")[0]);
  // filter out anything that doesn't look like an address
  const filteredAddresses = addresses.filter((address) => {
    return address.match(/^0x[0-9a-fA-F]{40}$/);
  });
  // deduplicate and sort
  const dedupedAddresses = Array.from(new Set(filteredAddresses)).sort();
  const totalAddresses = dedupedAddresses.length;

  logger.info(`Found ${totalAddresses} addresses to inspect`);
  let acceptCount = 0;
  let rejectCount = 0;
  let inspectedCount = 0;
  const rejectedAddressData = [];
  const reasonCounts: Record<string, number> = {};
  let fileContentHash: string | null = null;

  for (const address of dedupedAddresses) {
    logger.info(`Inspecting ${address}`);
    // look for the address in the data folder for a pre-existing cache
    let cache: CachedApiCallData = {};
    let cacheHit = false;
    if (dataFolder) {
      const dataFilePath = path.join(dataFolder, `${address}.json`);
      const dataFileExists = fs.existsSync(dataFilePath);
      if (dataFileExists) {
        const dataFileText = await fs.promises.readFile(dataFilePath, "utf-8");
        // hash the data file text to see if anything changes later
        fileContentHash = hashString(dataFileText);
        cache = JSON.parse(dataFileText);
        cacheHit = true;
      }
    }

    const result = await ruleset.check(formDepositInfo(address));

    // open the data folder and store the cache by <address>.json
    if (dataFolder) {
      const dataFolderExists = fs.existsSync(dataFolder);
      if (!dataFolderExists) {
        fs.mkdirSync(dataFolder, { recursive: true });
      }
      const dataFilePath = path.join(dataFolder, `${address}.json`);
      const dataToWrite = JSON.stringify(cache, null, 2);
      const newHash = hashString(dataToWrite);
      if (newHash !== fileContentHash) {
        logger.info("updating cache file");
        await fs.promises.writeFile(dataFilePath, dataToWrite);
      }
    }
    if (isRejection(result)) {
      logger.info(`Rejected ${address} because ${result.reason}`);
      rejectCount++;
      rejectedAddressData.push({
        address,
        cache,
      });
      if (reasonCounts[result.reason]) {
        reasonCounts[result.reason]++;
      } else {
        reasonCounts[result.reason] = 1;
      }
      showReasonCounts(logger, reasonCounts);
    } else {
      logger.info(`Accepted ${address}`);
      acceptCount++;
    }
    inspectedCount++;

    logger.info(
      `Current acceptance rate is ${acceptCount}/${inspectedCount} (${
        (acceptCount / inspectedCount) * 100
      }%)`
    );

    if (!cacheHit) {
      // wait for the delay to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, delayNumber * 1000));
    }
  }

  const percentAccepted = (acceptCount / totalAddresses) * 100;
  const percentRejected = (rejectCount / totalAddresses) * 100;
  logger.info(
    `Inspection complete. Accepted ${acceptCount} / ${totalAddresses} addresses (${percentAccepted}%) and rejected ${rejectCount}/${totalAddresses} addresses (${percentRejected}%)`
  );

  showReasonCounts(logger, reasonCounts);

  // write the output data to the output file
  await fs.promises.writeFile(
    outputData,
    JSON.stringify(rejectedAddressData, null, 2)
  );
}

export default runInspector;
