import { sleep, runCommand, ROOT_DIR } from "../utils";
import * as compose from "docker-compose";

export const GRAPH_NODE_COMPOSE_CWD = `${ROOT_DIR}/graph-node/docker`;
const GRAPH_NODE_COMPOSE_OPTS: compose.IDockerComposeOptions = {
  cwd: GRAPH_NODE_COMPOSE_CWD,
  commandOptions: [["--force-recreate"], ["--renew-anon-volumes"]],
};

export const SUBGRAPH_CWD = `${ROOT_DIR}/subgraph`;

// NOTE: `_config` here is actually unused - it just uses what's currently hardcoded in `subgraph.yaml`
// TODO: parse / modify / backup subgraph.yaml or find a way to do this through CLI (doubtful) so we can actually set this config
export async function startSubgraph(): Promise<() => Promise<void>> {
  // start graph node
  console.log("starting graph node...");
  const res = await compose.upAll(GRAPH_NODE_COMPOSE_OPTS);
  console.log(res);
  await sleep(20_000);

  // deploy subgraph
  try {
    console.log("deploying subgraph...");
    const [stdout, stderr] = await runCommand(
      `yarn create-local && yarn deploy-local`,
      SUBGRAPH_CWD
    );
    console.log(stdout);
    if (stderr) {
      console.error(stderr);
    }
  } catch (err) {
    console.error(err);
    throw err;
  }

  return async () => {
    await compose.down({
      cwd: GRAPH_NODE_COMPOSE_CWD,
      commandOptions: [["--volumes"]],
    });
  };
}
