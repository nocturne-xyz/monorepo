import { parseAndFilterCsvOfAddresses } from "../utils";
import { Command } from "commander";

export const returnDepositors = new Command("return-depositors")
  .summary("Print list of return depositors (at least 2 deposits)")
  .description(
    "Print list of return depositors to number of deposits. Minimum 2 deposits to show in list."
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
