import { Command } from "commander";
import runMonitor from "./monitor";

const run = new Command("run").description(
  "run a deposit screener component (run server or processor)"
);
run.addCommand(runMonitor);
export default run;
