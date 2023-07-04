#! /usr/bin/env node

import { program } from "commander";
import { run } from "./run";
import * as dotenv from "dotenv";
import { setupDefaultInstrumentation } from "@nocturne-xyz/offchain-utils";
import { ACTOR_NAME } from "../actor";

export default async function main(): Promise<void> {
  dotenv.config();
  setupDefaultInstrumentation(ACTOR_NAME);

  program
    .name("test-actor-cli")
    .description("CLI for running nocturne test actor")
    .addCommand(run);
  await program.parseAsync(process.argv);
}

main()
  .then(() => {
    console.log(`test-actor-cli ran to completion`);
    process.exit(0);
  })
  .catch((e) => {
    console.log(`test-actor-cli exited with error: ${e}`);
    process.exit(1);
  });
