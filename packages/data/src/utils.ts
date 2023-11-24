import { Address } from "@nocturne-xyz/core";
import fs from "fs";

interface ParseAndFilterCsvOfAddressesOpts {
  dedupAddresses?: boolean;
}

export async function parseAndFilterCsvOfAddresses(
  path: string,
  opts: ParseAndFilterCsvOfAddressesOpts = {}
): Promise<Address[]> {
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
  return opts.dedupAddresses
    ? dedupAddressesInOrder(filteredAddresses)
    : filteredAddresses;
}

export function dedupAddressesInOrder(addresses: string[]): string[] {
  // deduplicate and sort
  const uniqueAddresses = new Set();
  const dedupedAddresses = [];
  for (const address of addresses) {
    if (!uniqueAddresses.has(address)) {
      uniqueAddresses.add(address);
      dedupedAddresses.push(address);
    }
  }

  return dedupedAddresses;
}
