import { SubtreeUpdateProver, SubtreeUpdateInputSignals, SubtreeUpdateProofWithPublicSignals, toJSON } from "@nocturne-xyz/sdk";

//@ts-ignore
import * as snarkjs from "snarkjs";
import * as fs from "fs";
import { spawn } from "child_process";

export function getRapidsnarkSubtreeUpdateProver(executableCmd: string, witnessGeneratorPath: string, _zkeyPath: string, tmpPath: string): SubtreeUpdateProver {
	return {
		prove: (inputs: SubtreeUpdateInputSignals, wasmPath: string = witnessGeneratorPath, zkeyPath = _zkeyPath) => proveSubtreeUpdateRapidsnark(inputs, executableCmd, wasmPath, zkeyPath, tmpPath),
		verify: ({ proof, publicSignals }: SubtreeUpdateProofWithPublicSignals, vkey: any) => snarkjs.groth16.verify(vkey, publicSignals, proof),
	};
};

async function proveSubtreeUpdateRapidsnark(inputs: SubtreeUpdateInputSignals, rapidsnarkExecutablePath: string, witnessGeneratorPath: string, zkeyPath: string, tmpPath: string): Promise<SubtreeUpdateProofWithPublicSignals> {
  const inputJsonPath = `${tmpPath}/_input.json`;
  const witnessPath = `${tmpPath}/_witness.wtns`;
  const proofJsonPath = `${tmpPath}/_proof.json`;
  const publicSignalsPath = `${tmpPath}/_public.json`;

  await fs.promises.writeFile(inputJsonPath, toJSON(inputs));
  await runCommand(`${witnessGeneratorPath} ${inputJsonPath} ${witnessPath}`);
  await runCommand(`${rapidsnarkExecutablePath} ${zkeyPath} ${witnessPath} ${proofJsonPath} ${publicSignalsPath}`);
  
  const [proofStr, publicSignalsStr] = await Promise.all([
    fs.promises.readFile(proofJsonPath, "utf-8"),
    fs.promises.readFile(publicSignalsPath, "utf-8"),
  ]);

  const proof = JSON.parse(proofStr);
  const publicSignals = JSON.parse(publicSignalsStr);
  
  return {
    proof,
    publicSignals,
  };
}

async function runCommand(cmd: string): Promise<[string, string]> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const child = spawn('sh', ['-c', cmd]);
    child.stdout.on('data', data => {
      const output = data.toString();
      console.log(output);
      stdout += output;
    });
    child.stderr.on('data', data => {
      const output = data.toString();
      console.error(output);
      stderr += output;
    });
    child.on('error', reject);
    child.on('exit', () => resolve([stdout, stderr]));
  });
}
