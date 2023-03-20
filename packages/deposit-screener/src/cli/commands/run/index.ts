import { Command } from "commander";
import runProcess from "./process";

const run = new Command("run").description(
  "Run a deposit screener action (run server or process)"
);
run.addCommand(runProcess);

export default run;
