import { Command } from "commander";
import runProcessor from "./processor";
import runFullfiller from "./fulfiller";

const run = new Command("run").description(
  "run a deposit screener component (run server or processor)"
);
run.addCommand(runProcessor);
run.addCommand(runFullfiller);

export default run;
