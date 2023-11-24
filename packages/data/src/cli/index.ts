#! /usr/bin/env node

import { program } from "commander";
import * as dotenv from "dotenv";
import { setupDefaultInstrumentation } from "@nocturne-xyz/offchain-utils";
import depositors from "./depositors";
import { returnDepositors } from "./returnDepositors";

export default async function main(): Promise<void> {
  dotenv.config();
  setupDefaultInstrumentation("data-cli");

  program
    .name("data-cli")
    .description("CLI for onchain data inspection")
    .addCommand(depositors)
    .addCommand(returnDepositors);
  await program.parseAsync(process.argv);
}

// ! HACK
// ! in principle, there should be no hanging promises once `main()` resolves or rejects.
// ! as a backstop, we manually call `process.exit()` to ensure the process actually exits
// ! even if there's a bug somewhere that results in a hanging promise
main()
  .then(() => {
    console.log(`data-cli ran to completion`);
    process.exit(0);
  })
  .catch((e) => {
    console.log(`data-cli exited with error: ${e}`);
    process.exit(1);
  });
