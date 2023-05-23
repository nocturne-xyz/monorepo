#! /usr/bin/env node

import { program } from "commander";
import run from "./commands/run";
import * as dotenv from "dotenv";

export default async function main(): Promise<void> {
  dotenv.config();

  program
    .name("subtree-updater-cli")
    .description("CLI for running/debugging subtree-updater components")
    .addCommand(run);
  await program.parseAsync(process.argv);
}

// ! HACK
// ! in principle, there should be no hanging promises once `main()` resolves or rejects.
// ! as a backstop, we manually call `process.exit()` to ensure the process actually exits
// ! even if there's a bug somewhere that results in a hanging promise
main()
  .then(() => {
    console.log(`subtree-updater-cli ran to completion`);
    process.exit(0);
  })
  .catch((e) => {
    console.log(`subtree-updater-cli exited with error: ${e}`);
    process.exit(1);
  });
