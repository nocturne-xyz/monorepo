import {
  SubtreeUpdateProver,
  SubtreeUpdateInputs,
  SubtreeUpdateProofWithPublicSignals,
  BaseProof,
} from "@nocturne-xyz/sdk";

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

    // create prover tmp dir if it DNE yet
    console.log("0");
    await fs.promises.mkdir(this.tmpDir, { recursive: true });

    console.log("1");
    await fs.promises.writeFile(
      inputJsonPath,
      serializeRapidsnarkInputs(inputs)
    );

    console.log("2");
    await runCommand(
      `${this.witnessGeneratorExecutablePath} ${inputJsonPath} ${witnessPath}`
    );
    console.log("3");

    await runCommand(
      `${this.rapidsnarkExecutablePath} ${this.zkeyPath} ${witnessPath} ${proofJsonPath} ${publicSignalsPath}`
    );

    console.log("4");
    const [proofStr, publicSignalsStr] = await Promise.all([
      fs.promises.readFile(proofJsonPath, "utf-8"),
      fs.promises.readFile(publicSignalsPath, "utf-8"),
    ]);

    console.log("5");
    const proof = deserializeRapidsnarkProof(proofStr);
    console.log("6");
    const publicSignals = deserializeRapidsnarkPublicSignals(publicSignalsStr);

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
      console.error(stderr);
      reject(stderr);
    });
    child.on("exit", () => {
      console.log(stdout);
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
