import { Command } from "commander";
import { runSubtreeUpdater } from "./runSubtreeUpdater";

const run = new Command("run").description(
  "run a subtree updater component (currently only `subtree-updater`)"
);
run.addCommand(runSubtreeUpdater);

export default run;
