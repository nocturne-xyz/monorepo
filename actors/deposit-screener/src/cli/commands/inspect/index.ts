import { Command } from "commander";
import runChecker from "./checker";

const run = new Command("run").description(
  "run a deposit screener component (run server or processor)"
);
run.addCommand(runChecker);

export default run;
