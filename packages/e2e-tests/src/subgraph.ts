import { sleep, runCommand } from "./utils";
import findWorkspaceRoot from "find-yarn-workspace-root";
import * as compose from "docker-compose";
import * as fs from "fs";

const ROOT_DIR = findWorkspaceRoot()!;

export const GRAPH_NODE_COMPOSE_CWD = `${ROOT_DIR}/graph-node/docker`;
const GRAPH_NODE_COMPOSE_OPTS: compose.IDockerComposeOptions = {
  cwd: GRAPH_NODE_COMPOSE_CWD,
};

export const SUBGRAPH_CWD = `${ROOT_DIR}/packages/subgraph`;

export interface SubgraphConfig {
  walletAddress: string;
  startBlock: number;
}

// NOTE: `_config` here is actually unused - it just uses what's currently hardcoded in `subgraph.yaml`
// TODO: parse / modify / backup subgraph.yaml or find a way to do this through CLI (doubtful) so we can actually set this config
export async function startSubgraph(_config: SubgraphConfig): Promise<void> {
  // clear data
  console.log("clearing graph node data...");
  await fs.promises.rm(`${GRAPH_NODE_COMPOSE_CWD}/data`, { recursive: true });

  // start graph node
  console.log("starting graph node...");
  const res = await compose.upAll(GRAPH_NODE_COMPOSE_OPTS);
  console.log(res);
  // await runCommand("yarn graph-node-up");
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
}

export async function stopSubgraph(): Promise<void> {
  await compose.down(GRAPH_NODE_COMPOSE_OPTS);
}
