import { Command } from "commander";
import runChecker from "./checker";
import runSnapshot from "./snapshot";

const run = new Command("inspect").description(
  "run an inspect command (checker or snapshot)"
);
run.addCommand(runChecker);
run.addCommand(runSnapshot);

export default run;
