import { Command } from "commander";
import runProcessor from "./processor";
import runServer from "./server";
import runInspector from "../inspect/checker";

const run = new Command("run").description(
  "run a deposit screener component (run server or processor)"
);
run.addCommand(runProcessor);
run.addCommand(runServer);
run.addCommand(runInspector);

export default run;
