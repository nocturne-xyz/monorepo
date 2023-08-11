import {
  SubtreeUpdateProver,
  SubtreeUpdateInputs,
  SubtreeUpdateProofWithPublicSignals,
  BaseProof,
} from "@nocturne-xyz/core";

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

  // rapidsnark writes to files, so if we have multiple provers running at the same time,
  // the proofs will overwrite each other. To prevent this, we use a global counter to
  // change the filenames
  proofId = 0;

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
    this.proofId += 1;

    const inputJsonPath = `${this.tmpDir}/_input-${this.proofId}.json`;
    const witnessPath = `${this.tmpDir}/_witness-${this.proofId}.wtns`;
    const proofJsonPath = `${this.tmpDir}/_proof-${this.proofId}.json`;
    const publicSignalsPath = `${this.tmpDir}/_public-${this.proofId}.json`;

    // create prover tmp dir if it DNE yet
    await fs.promises.mkdir(this.tmpDir, { recursive: true });
    await fs.promises.writeFile(
      inputJsonPath,
      serializeRapidsnarkInputs(inputs)
    );

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

    const proof = deserializeRapidsnarkProof(proofStr);
    const publicSignals = deserializeRapidsnarkPublicSignals(publicSignalsStr);

    await Promise.all([
      fs.promises.rm(inputJsonPath),
      fs.promises.rm(witnessPath),
      fs.promises.rm(proofJsonPath),
      fs.promises.rm(publicSignalsPath),
    ]);

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
    child.on("error", () => {
      console.log(stdout);
      console.error(stderr);
      reject(stderr);
    });
    child.on("exit", () => {
      console.log(stdout);
      console.error(stderr);
      resolve([stdout, stderr]);
    });
  });
}

function deserializeRapidsnarkProof(proofStr: string): BaseProof {
  const proof = JSON.parse(proofStr);
  proof.pi_a = proof.pi_a.map((x: string) => BigInt(x));
  proof.pi_b = proof.pi_b.map((point: string[]) =>
    point.map((x: string) => BigInt(x))
  );
  proof.pi_c = proof.pi_c.map((x: string) => BigInt(x));
  return proof;
}

function deserializeRapidsnarkPublicSignals(
  publicSignalsStr: string
): [bigint, bigint, bigint, bigint] {
  return JSON.parse(publicSignalsStr).map((x: string) => BigInt(x));
}

function serializeRapidsnarkInputs(inputs: SubtreeUpdateInputs): string {
  return JSON.stringify(inputs, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value
  );
}
