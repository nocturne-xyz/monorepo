import { SolidityProof, BaseProof } from "./types";

export function packToSolidityProof(proof: BaseProof): SolidityProof {
  return [
    BigInt(proof.pi_a[0]),
    BigInt(proof.pi_a[1]),
    BigInt(proof.pi_b[0][1]),
    BigInt(proof.pi_b[0][0]),
    BigInt(proof.pi_b[1][1]),
    BigInt(proof.pi_b[1][0]),
    BigInt(proof.pi_c[0]),
    BigInt(proof.pi_c[1]),
  ];
}

export function unpackFromSolidityProof(proof: SolidityProof): BaseProof {
  return {
    pi_a: [proof[0], proof[1], 1n],
    pi_b: [
      [proof[3], proof[2]],
      [proof[5], proof[4]],
      [1n, 0n],
    ],
    pi_c: [proof[6], proof[7], 1n],
    protocol: "groth16",
    curve: "bn128",
  };
}
