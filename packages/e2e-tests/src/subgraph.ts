import { sleep, runCommand } from "./utils";
import findWorkspaceRoot from "find-yarn-workspace-root";
import * as compose from "docker-compose";

const ROOT_DIR = findWorkspaceRoot()!;

export const GRAPH_NODE_COMPOSE_CWD = `${ROOT_DIR}/graph-node/docker`;
const GRAPH_NODE_COMPOSE_OPTS: compose.IDockerComposeOptions = {
  cwd: GRAPH_NODE_COMPOSE_CWD,
};

export const SUBGRAPH_CWD = `${ROOT_DIR}/packages/subgraph`;

interface SubgraphConfig {
  walletAddress: string;
  startBlock: number;
}

export async function startSubgraph(_config: SubgraphConfig): Promise<void> {
  // clear data
  console.log("clearing graph node data...");
  let [stdout, stderr] = await runCommand(
    `rm -rf data`,
    GRAPH_NODE_COMPOSE_CWD
  );
  console.log(stdout);
  if (stderr) {
    console.error(stderr);
  }

  // start graph node
  console.log("starting graph node...");
  const res = await compose.upAll(GRAPH_NODE_COMPOSE_OPTS);
  console.log(res);
  // await runCommand("yarn graph-node-up");
  await sleep(20_000);

  // deploy subgraph
  console.log("deploying subgraph...");
  [stdout, stderr] = await runCommand(
    `yarn create-local && yarn deploy-local`,
    SUBGRAPH_CWD
  );
  console.log(stdout);
  if (stderr) {
    console.error(stderr);
  }
}

export async function stopSubgraph(): Promise<void> {
  await compose.down(GRAPH_NODE_COMPOSE_OPTS);
  await sleep(10_000);
}
