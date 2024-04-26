#! /usr/bin/env node

import { program, Command } from "commander";
import { setup } from "./setup";
import { WithdrawalClient } from "./withdraw";
import * as dotenv from "dotenv";
import { setupEjectorDeployment } from "./deployment";

export default async function main(): Promise<void> {
  dotenv.config();

  program
    .name("nocturne-ejector")
    .description("CLI for withdrawing from Nocturne post-shutdown")
    .addCommand(withdraw);
  await program.parseAsync(process.argv);
}

const withdraw = new Command("withdraw")
  .summary("withdraw from Nocturne post-shutdown")
  .description(
    "must supply .env file with RPC_URL, SPEND_PRIVATE_KEY, and WITHDRAWAL_EOA_PRIVATE_KEY"
  )
  .option(
    "--update-tree",
    "if this option is set, the CLI will also run a subtree-updater and update the tree. 99.99% of the time you won't need this - it's only needed if, for some reason, not all of the nodes for an asset are spent at once. See the README for more information.",
    false
  )
  .option(
    "--config-path",
    "path to the nocturne deployment config file. 99.99% of the time you wont need this - it's only needed if you want to interact with a secondary deployment of the nocturne contracts. See the README for more information."
  )
  .action(async (options) => {
    const { updateTree, configPath } = options;

    // download any artifacts necessary for withdrawal, including circuits
    await setup({ skipSubtreeUpdateCircuit: !updateTree });

    // setup local deployment of necessary offchain infra
    // by default, this is just the subgraph.
    // if updateTree is set, this will also run the subtree-updater and the insertion writer
    const localDeployment = await setupEjectorDeployment({
      updateTree,
      networkNameOrConfigPath: configPath,
    });
    const client = new WithdrawalClient(configPath);

    // sync all note balances into the withdrawal client
    await client.sync();

    // withdraw all notes of every asset owned by the nocturne acount with the provided spend private key
    await client.withdrawEverything();

    // if updateTree is set, fill a batch with zeros and wait for a subtree update to take place
    if (updateTree) {
      await localDeployment.fillSubtreeBatch();
    }

    // teardown local deployment after we're done
    await localDeployment.teardown();
  });

process.on("SIGINT", () => {
  process.exit(1);
});

// ! HACK
// ! in principle, there should be no hanging promises once `main()` resolves or rejects.
// ! as a backstop, we manually call `process.exit()` to ensure the process actually exits
// ! even if there's a bug somewhere that results in a hanging promise
main()
  .then(() => {
    process.exit(0);
  })
  .catch((e) => {
    console.log(`exited with error: ${e}`);
    process.exit(1);
  });
