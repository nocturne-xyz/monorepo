import { Command } from "commander";
import runServer from "./server";
import runProcessor from "./processor";

const run = new Command("run").description(
  "run a bundler component (server, batcher, or submitter)"
);
run.addCommand(runServer);
run.addCommand(runProcessor);

export default run;
