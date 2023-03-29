import { Command } from "commander";
import runProcessor from "./processor";

const run = new Command("run").description(
  "run a deposit screener component (run server or processor)"
);
run.addCommand(runProcessor);

export default run;
