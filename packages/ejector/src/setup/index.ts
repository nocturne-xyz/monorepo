import { cloneGraphNode } from "./cloneGraphNode";
import { downloadCircuitArtifacts } from "./downloadCircuitArtifacts";

export async function setup(): Promise<void> {
  await Promise.all([cloneGraphNode(), downloadCircuitArtifacts()]);
}
