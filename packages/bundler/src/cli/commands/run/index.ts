import { Command } from "commander";
import runBatcher from "./batcher";
import runServer from "./server";
import runSubmitter from "./submitter";

const run = new Command("run").description(
  "run a bundler component (server, batcher, or submitter)"
);
run.addCommand(runServer);
run.addCommand(runBatcher);
run.addCommand(runSubmitter);

export default run;
