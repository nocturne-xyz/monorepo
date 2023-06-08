#! /usr/bin/env node

require("../instrumentation");
import { program } from "commander";
import run from "./commands/run";
import * as dotenv from "dotenv";

export default async function main(): Promise<void> {
  dotenv.config();

  program
    .name("screener-cli")
    .description("CLI for running/debugging deposit-screener components")
    .addCommand(run);
  await program.parseAsync(process.argv);
}

// ! HACK
// ! in principle, there should be no hanging promises once `main()` resolves or rejects.
// ! as a backstop, we manually call `process.exit()` to ensure the process actually exits
// ! even if there's a bug somewhere that results in a hanging promise
main()
  .then(() => {
    console.log(`deposit-screener-cli ran to completion`);
    process.exit(0);
  })
  .catch((e) => {
    console.log(`deposit-screener-cli exited with error: ${e}`);
    process.exit(1);
  });
