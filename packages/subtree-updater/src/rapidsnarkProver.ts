import {
  SubtreeUpdateProver,
  SubtreeUpdateInputs,
  SubtreeUpdateProofWithPublicSignals,
} from "@nocturne-xyz/sdk";
import * as JSON from "bigint-json-serialization";

//@ts-ignore
import * as snarkjs from "snarkjs";
import * as fs from "fs";
import { spawn } from "child_process";

export class RapidsnarkSubtreeUpdateProver implements SubtreeUpdateProver {
  rapidsnarkExecutablePath: string;
  witnessGeneratorExecutablePath: string;
  zkeyPath: string;
  tmpDir: string;
  vkey: any;

  constructor(
    rapidsnarkExecutablePath: string,
    witnessGeneratorExecutablePath: string,
    zkeyPath: string,
    vkeyPath: string,
    tmpDir: string = __dirname
  ) {
    this.rapidsnarkExecutablePath = rapidsnarkExecutablePath;
    this.witnessGeneratorExecutablePath = witnessGeneratorExecutablePath;
    this.zkeyPath = zkeyPath;
    this.tmpDir = tmpDir;
    this.vkey = JSON.parse(fs.readFileSync(vkeyPath).toString());
  }

  async proveSubtreeUpdate(
    inputs: SubtreeUpdateInputs
  ): Promise<SubtreeUpdateProofWithPublicSignals> {
    const inputJsonPath = `${this.tmpDir}/_input.json`;
    const witnessPath = `${this.tmpDir}/_witness.wtns`;
    const proofJsonPath = `${this.tmpDir}/_proof.json`;
    const publicSignalsPath = `${this.tmpDir}/_public.json`;

    await fs.promises.writeFile(inputJsonPath, JSON.stringify(inputs));
    await runCommand(
      `${this.witnessGeneratorExecutablePath} ${inputJsonPath} ${witnessPath}`
    );
    await runCommand(
      `${this.rapidsnarkExecutablePath} ${this.zkeyPath} ${witnessPath} ${proofJsonPath} ${publicSignalsPath}`
    );

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

  async verifySubtreeUpdate({
    proof,
    publicSignals,
  }: SubtreeUpdateProofWithPublicSignals): Promise<boolean> {
    return await snarkjs.groth16.verify(this.vkey, publicSignals, proof);
  }
}

async function runCommand(cmd: string): Promise<[string, string]> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const child = spawn("sh", ["-c", cmd]);
    child.stdout.on("data", (data) => {
      const output = data.toString();
      stdout += output;
    });
    child.stderr.on("data", (data) => {
      const output = data.toString();
      stderr += output;
    });
    child.on("error", reject);
    child.on("exit", () => resolve([stdout, stderr]));
  });
}
