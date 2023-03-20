#! /usr/bin/env node

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

main().catch((e) => console.log(`Deposit screener exited with error: ${e}`));
