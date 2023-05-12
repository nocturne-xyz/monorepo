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

main().catch((e) => console.log(`subtree updater exited with error: ${e}`));
