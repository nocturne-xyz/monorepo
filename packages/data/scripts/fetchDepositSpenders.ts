// import { DepositEventType } from "@nocturne-xyz/core";
import {
  Address,
  DepositEventType,
  TotalEntityIndexTrait,
} from "@nocturne-xyz/core";
import { fetchDepositEvents } from "@nocturne-xyz/subgraph-sync-adapters/src/depositEvents/fetch";
import { createObjectCsvWriter } from "csv-writer";

interface FetchDepositSpendersOpts {
  type: DepositEventType;
  fromBlock: number;
  toBlock: number;
}

async function writeSpendersToCsv(
  spenders: Address[],
  opts: FetchDepositSpendersOpts
): Promise<void> {
  const fileName = `spenders-${opts.fromBlock}-to-${opts.toBlock}.csv`;
  const csvWriter = createObjectCsvWriter({
    path: fileName,
    header: ["spender"],
  });

  const records = spenders.map((spender) => ({ spender }));
  try {
    await csvWriter.writeRecords(records);
    console.log(`Data written to ${fileName}`);
  } catch (error) {
    console.error("Error writing to CSV:", error);
    throw error;
  }
}

async function fetchDepositSpenders(
  opts: FetchDepositSpendersOpts
): Promise<Address[]> {
  const depositEvents = await fetchDepositEvents(
    "https://api.goldsky.com/api/public/project_cldkt6zd6wci33swq4jkh6x2w/subgraphs/nocturne/0.2.0-mainnet/gn",
    {
      type: "Instantiated",
      fromTotalEntityIndex: TotalEntityIndexTrait.fromBlockNumber(
        opts.fromBlock
      ),
      toTotalEntityIndex: TotalEntityIndexTrait.fromBlockNumber(opts.toBlock),
      limit: 1000,
    }
  );

  return depositEvents.map((event) => event.inner.spender);
}

const FROM_BLOCK = 18524528;
const TO_BLOCK = 18611316;
(async () => {
  const spenders = await fetchDepositSpenders({
    type: DepositEventType.Instantiated,
    fromBlock: FROM_BLOCK,
    toBlock: TO_BLOCK,
  });
  console.log(spenders);

  await writeSpendersToCsv(spenders, {
    type: DepositEventType.Instantiated,
    fromBlock: FROM_BLOCK,
    toBlock: TO_BLOCK,
  });

  process.exit(0);
})();
