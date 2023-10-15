import { makeLogger } from "@nocturne-xyz/offchain-utils";
import { Command } from "commander";
import fs from "fs";
import { requireApiKeys } from "../../../utils";
import { RULESET_V1 } from "../../../screening/checks/v1/RULESET_V1";
import { isRejection } from "../../../screening/checks/RuleSet";
import { Logger } from "winston";
import {
  AddressDataSnapshot,
  dedupAddressesInOrder,
  formDepositInfo,
  getLocalRedis,
  populateRedisCache,
} from "./utils";
import * as JSON from "bigint-json-serialization";
import path from "path";

/**
 * Example
 * yarn deposit-screener-cli inspect check --snapshot-input-dir ./snapshot/addresses.json --output-data output --stdout-log-level=info
 */
const runChecker = new Command("check")
  .summary("inspect and analyze addresses from a snapshot JSON file")
  .description(
    "analyzes a list of addresses, provides acceptance metrics and rejection reasons"
  )
  .requiredOption(
    "--snapshot-json-path <path>",
    "path to the snapshot JSON file"
  )
  .requiredOption(
    "--output-dir <path>",
    "path to output accept and reject json files"
  )
  .option(
    "--log-dir <string>",
    "directory to write logs to",
    "./logs/address-checker"
  )
  .option(
    "--stdout-log-level <string>",
    "min log importance to log to stdout. if not given, logs will not be emitted to stdout"
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

function ensureDirectoriesExist(
  snapshotJsonPath: string,
  outputDir: string
): void {
  if (!fs.existsSync(snapshotJsonPath)) {
    throw new Error(`Snapshot file ${snapshotJsonPath} does not exist`);
  }

  // check that the dir where we are going to output to exists using the path library, if not, create it
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // check if we can write to the output directory
  try {
    fs.accessSync(outputDir, fs.constants.W_OK);
  } catch (err) {
    throw new Error(`Cannot write to output directory ${outputDir}`);
  }
}

async function main(options: any): Promise<void> {
  requireApiKeys();

  const { snapshotJsonPath, outputDir, logDir, stdoutLogLevel } = options;
  ensureDirectoriesExist(snapshotJsonPath, outputDir);

  const logger = makeLogger(
    logDir,
    "address-checker",
    "checker",
    stdoutLogLevel
  );

  const redis = await getLocalRedis();
  const ruleset = RULESET_V1(redis);

  // Populate redis cache with snapshot file contents
  logger.info(`Populating redis cache with data from ${snapshotJsonPath}`);
  const snapshotData = JSON.parse(
    fs.readFileSync(snapshotJsonPath, "utf-8")
  ) as AddressDataSnapshot;
  await populateRedisCache(snapshotData, redis);

  // deduplicate and sort
  const allAddresses = Object.keys(snapshotData);
  const dedupedAddresses = dedupAddressesInOrder(allAddresses);
  const totalAddresses = dedupedAddresses.length;

  logger.info(`Found ${totalAddresses} addresses to inspect`);
  let acceptCount = 0;
  let rejectCount = 0;
  let inspectedCount = 0;
  const rejectedAddressData = [];
  const acceptedAddressData = [];
  const reasonCounts: Record<string, number> = {};

  for (const address of dedupedAddresses) {
    logger.info(`Inspecting ${address}`);

    const result = await ruleset.check(formDepositInfo(address));

    if (isRejection(result)) {
      logger.info(`Rejected ${address} because ${result.reason}`);
      rejectCount++;
      rejectedAddressData.push({
        address,
        result,
      });
      if (reasonCounts[result.reason]) {
        reasonCounts[result.reason]++;
      } else {
        reasonCounts[result.reason] = 1;
      }
    } else {
      logger.info(`Accepted ${address}`);
      acceptedAddressData.push({
        address,
        result,
      });
      acceptCount++;
    }

    logger.info(
      `Current acceptance rate is ${acceptCount}/${inspectedCount} (${
        (acceptCount / inspectedCount) * 100
      }%)`
    );
    inspectedCount++;
  }

  const percentAccepted = (acceptCount / totalAddresses) * 100;
  const percentRejected = (rejectCount / totalAddresses) * 100;
  logger.info(
    `Inspection complete. Accepted ${acceptCount} / ${totalAddresses} addresses (${percentAccepted}%) and rejected ${rejectCount}/${totalAddresses} addresses (${percentRejected}%)`
  );

  showReasonCounts(logger, reasonCounts);

  // write the output data to the output file
  const rejectedOutputFile = path.join(outputDir, "rejected.json");
  const acceptedOutputFile = path.join(outputDir, "accepted.json");

  await Promise.all([
    fs.promises.writeFile(
      rejectedOutputFile,
      JSON.stringify(rejectedAddressData)
    ),
    fs.promises.writeFile(
      acceptedOutputFile,
      JSON.stringify(acceptedAddressData)
    ),
  ]);
}

export default runChecker;