import { Command } from "commander";
import runChecker from "./check";
import runSnapshot from "./snapshot";
import runTrmTxMonitor from "./trmTxMonitor";

const run = new Command("inspect").description(
  "run an inspect command (check or snapshot)"
);
run.addCommand(runChecker);
run.addCommand(runSnapshot);
run.addCommand(runTrmTxMonitor);

export default run;
