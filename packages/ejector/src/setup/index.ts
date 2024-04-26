import { downloadCircuitArtifacts } from "./downloadCircuitArtifacts";

export type SetupArgs = {
  skipSubtreeUpdateCircuit: boolean;
};
export async function setup(args: SetupArgs): Promise<void> {
  await Promise.all([downloadCircuitArtifacts(args.skipSubtreeUpdateCircuit)]);
}
