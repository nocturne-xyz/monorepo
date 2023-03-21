import { Command } from "commander";
import runProcessor from "./processor";

const run = new Command("run").description(
  "Run a deposit screener action (run server or process)"
);
run.addCommand(runProcessor);

export default run;
