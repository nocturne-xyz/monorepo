import { parseAndFilterCsvOfAddresses } from "./utils";
import { Command } from "commander";

export const returnDepositors = new Command("return-depositors")
  .summary("Fetch depositors and write to CSV")
  .description(
    "Fetch depositors for a block range then write to single-column CSV"
  )
  .requiredOption("--input-csv <string>", "Path to input CSV")
  .action(main);

async function main(options: any): Promise<void> {
  const { inputCsv } = options;

  const addresses = await parseAndFilterCsvOfAddresses(inputCsv, {
    dedupAddresses: false,
  });

  const depositorsMap = new Map<string, number>();
  for (const address of addresses) {
    const count = depositorsMap.get(address) || 0;
    depositorsMap.set(address, count + 1);
  }

  const filtered = new Map(
    Array.from(depositorsMap.entries())
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
  );

  console.log(filtered);
}
