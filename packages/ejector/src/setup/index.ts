import { getSubmodules } from "./getSubmodules";
import { downloadCircuitArtifacts } from "./downloadCircuitArtifacts";

export async function setup(): Promise<void> {
  await Promise.all([getSubmodules(), downloadCircuitArtifacts()]);
}
