import { Command } from "commander";
import runBatcher from "./batcher";
import runServer from "./server";

const run = new Command("run").description(
  "Run a bundler component (server, batcher, or submitter)"
);
run.addCommand(runServer);
run.addCommand(runBatcher);

export default run;
