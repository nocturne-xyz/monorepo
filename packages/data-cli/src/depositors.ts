import {
  Address,
  DepositEventType,
  TotalEntityIndexTrait,
} from "@nocturne-xyz/core";
import { fetchDepositEvents } from "@nocturne-xyz/subgraph-sync-adapters";
import { Command } from "commander";
import { createObjectCsvWriter } from "csv-writer";

interface FetchDepositorsOpts {
  type: DepositEventType;
  fromBlock: number;
  toBlock: number;
  limit?: number;
}

async function writeDepositorsToCsv(
  depositors: Address[],
  opts: FetchDepositorsOpts
): Promise<void> {
  const fileName = `depositors-${opts.fromBlock}-to-${opts.toBlock}.csv`;
  const csvWriter = createObjectCsvWriter({
    path: fileName,
    header: ["spender"],
  });

  const records = depositors.map((spender) => ({ spender }));
  try {
    await csvWriter.writeRecords(records);
    console.log(`Data written to ${fileName}`);
  } catch (error) {
    console.error("Error writing to CSV:", error);
    throw error;
  }
}

async function fetchDepositors(
  subgraphUrl: string,
  opts: FetchDepositorsOpts
): Promise<Address[]> {
  const depositEvents = await fetchDepositEvents(subgraphUrl, {
    type: opts.type,
    fromTotalEntityIndex: TotalEntityIndexTrait.fromBlockNumber(opts.fromBlock),
    toTotalEntityIndex: TotalEntityIndexTrait.fromBlockNumber(opts.toBlock),
    limit: opts.limit,
  });

  return depositEvents.map((event) => event.inner.spender);
}

const depositors = new Command("depositors")
  .summary("Fetch depositors and write to CSV")
  .description(
    "Fetch depositors for a block range then write to single-column CSV"
  )
  .requiredOption("--from-block <number>", "Block number to start from")
  .requiredOption("--to-block <number>", "Block number to end at")
  .option("--limit <number>", "Max number of depositors to fetch", "1000")
  .action(main);

async function main(options: any): Promise<void> {
  const { fromBlock, toBlock, limit } = options;

  const subgraphUrl = process.env.SUBGRAPH_URL;
  if (!subgraphUrl) {
    throw new Error("SUBGRAPH_URL env var not set");
  }

  const depositors = await fetchDepositors(subgraphUrl, {
    type: DepositEventType.Instantiated,
    fromBlock,
    toBlock,
    limit,
  });

  console.log(`Found ${depositors.length} depositors`);
  console.log(depositors);

  await writeDepositorsToCsv(depositors, {
    type: DepositEventType.Instantiated,
    fromBlock,
    toBlock,
  });

  process.exit(0);
}

export default depositors;
