#! /usr/bin/env node

import { program } from "commander";
import run from "./commands/run";
import * as dotenv from "dotenv";

export default async function main(): Promise<void> {
  dotenv.config();

  program
    .name("bundler-cli")
    .description("CLI for running/debugging bundler components")
    .addCommand(run);
  await program.parseAsync(process.argv);
}

main().catch((e) => console.log(`Bundler exited with error: ${e}`));
