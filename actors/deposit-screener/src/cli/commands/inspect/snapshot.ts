import { makeLogger } from "@nocturne-xyz/offchain-utils";
import { Command } from "commander";
import fs from "fs";
import { requireApiKeys } from "../../../utils";
import path from "path";
import { createWriteStream } from "fs";
import { API_CALL_MAP, ApiCallNames } from "../../../screening/checks/apiCalls";
import { Address, sleep } from "@nocturne-xyz/core";
import * as JSON from "bigint-json-serialization";
import { CachedAddressData, formDepositInfo, getLocalRedis } from "./utils";

/**
 * Example
 * yarn deposit-screener-cli inspect snapshot --input-csv ./data/addresses.csv --output-data ./data/addresses.json --delay-ms=3000 --stdout-log-level=info
 */
const runSnapshot = new Command("snapshot")
  .summary("create data snapshot for CSV or JSON file of addresses")
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
    "./logs/address-snapshot"
  )
  .option(
    "--delay-ms <number>",
    "delay ms between requests to avoid rate limits (in ms)",
    "500"
  )
  .option(
    "--stdout-log-level <string>",
    "min log importance to log to stdout. if not given, logs will not be emitted to stdout"
  )
  .action(main);

async function parseAndFilterCsvOfAddresses(path: string): Promise<Address[]> {
  const inputFileText = await fs.promises.readFile(path, "utf-8");
  // split the input file into lines
  const inputFileLines = inputFileText.split("\n");
  // take the first column
  const addresses = inputFileLines.map((line) => line.trim().split(",")[0]);
  // filter out anything that doesn't look like an address
  const filteredAddresses = addresses.filter((address) => {
    return address.match(/^0x[0-9a-fA-F]{40}$/i);
  });

  // deduplicate and sort
  const uniqueAddresses = new Set();
  const dedupedAddresses = [];
  for (const address of filteredAddresses) {
    if (!uniqueAddresses.has(address)) {
      uniqueAddresses.add(address);
      dedupedAddresses.push(address);
    }
  }

  return dedupedAddresses;
}

async function main(options: any): Promise<void> {
  requireApiKeys();

  const { inputCsv, outputData, logDir, stdoutLogLevel, delayMs } = options;

  const logger = makeLogger(
    logDir,
    "address-checker",
    "checker",
    stdoutLogLevel
  );

  if (!fs.existsSync(inputCsv)) {
    throw new Error(`Input file ${inputCsv} does not exist`);
  }

  const delayNumber = Number(delayMs);
  if (isNaN(delayNumber)) {
    throw new Error(`Delay ${delayMs} is not a number`);
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

  const redis = await getLocalRedis();

  logger.info(`Starting inspection for addresses from ${inputCsv}`);
  const dedupedAddresses = await parseAndFilterCsvOfAddresses(inputCsv);
  const numAddresses = dedupedAddresses.length;

  logger.info(`Found ${numAddresses} addresses to inspect`);

  const writeStream = createWriteStream(outputData, { encoding: "utf-8" });
  writeStream.write("{");

  console.log(`There are ${numAddresses} addresses to snapshot`);
  let count = 0;

  for (const address of dedupedAddresses) {
    console.log(
      `Starting API calls for address: ${address} ——— ${(count += 1)} of ${numAddresses}`
    );

    const deposit = formDepositInfo(address);
    let addressData: CachedAddressData = {};

    for (const [callName, apiCall] of Object.entries(API_CALL_MAP)) {
      if (
        callName === API_CALL_MAP.MISTTRACK_ADDRESS_OVERVIEW.name ||
        callName === API_CALL_MAP.MISTTRACK_ADDRESS_RISK_SCORE.name ||
        callName === API_CALL_MAP.MISTTRACK_ADDRESS_LABELS.name
      ) {
        console.log(
          `Sleeping for ${delayMs} ms to avoid Misttrack rate limit...`
        );
        await sleep(delayMs);
      }

      console.log(`Calling ${callName} for ${address}...`);
      addressData[callName as ApiCallNames] = await apiCall(deposit, redis, {
        ttlSeconds: 48 * 60 * 60,
      });
      console.log(`Successfully called ${callName} for ${address}`);
    }

    writeStream.write(`"${address}": ${JSON.stringify(addressData)}`);
    // Add a comma only if this is not the last address
    if (count < numAddresses) {
      writeStream.write(",");
    }
  }

  // Returning a promise that resolves when writing finishes
  await new Promise<void>((resolve) => {
    writeStream.end("}", () => {
      console.log("Snapshot saved successfully");
      resolve();
    });
  });
}

export default runSnapshot;
