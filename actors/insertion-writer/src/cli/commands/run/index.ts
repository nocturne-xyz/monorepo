import { Command } from "commander";
import { runInsertionWriter } from "./runInsertionWriter";

const run = new Command("run").description(
  "run an insertion-writer component (currently only `insertion-writer`)"
);
run.addCommand(runInsertionWriter);

export default run;
