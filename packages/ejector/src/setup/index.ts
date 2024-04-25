import { downloadCircuitArtifacts } from "./downloadCircuitArtifacts";

export async function setup(): Promise<void> {
  await Promise.all([downloadCircuitArtifacts()]);
}
