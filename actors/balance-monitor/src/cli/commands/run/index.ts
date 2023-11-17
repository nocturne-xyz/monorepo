import { Command } from "commander";
import runMonitor from "./monitor";

const run = new Command("run").description(
  "run balance monitor and pipe metrics"
);
run.addCommand(runMonitor);
export default run;
