import { Command } from "commander";
import runProcessor from "./processor";
import runServer from "./server";

const run = new Command("run").description(
  "run a deposit screener component (run server or processor)"
);
run.addCommand(runProcessor);
run.addCommand(runServer);

export default run;
