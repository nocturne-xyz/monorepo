import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
const circomlibjs = require("circomlibjs");
const poseidonContract = circomlibjs.poseidon_gencontract;

import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
import * as fs from "fs";

const ROOT = findWorkspaceRoot()!;
const BATCH_BINARY_MERKLE_PATH = path.join(
  ROOT,
  "contract-artifacts/BatchBinaryMerkle.json"
);
const POSEIDON_BATCH_BINARY_MERKLE_PATH = path.join(
  ROOT,
  "contract-artifacts/PoseidonBatchBinaryMerkle.json"
);

function linkBytecode(artifact: any, libraries: any) {
  let bytecode = artifact.bytecode;

  for (const [fileName, fileReferences] of Object.entries(
    artifact.linkReferences
  )) {
    for (const [libName, fixups] of Object.entries(fileReferences)) {
      const addr = libraries[libName];
      if (addr === undefined) {
        continue;
      }

      for (const fixup of fixups) {
        bytecode =
          bytecode.substr(0, 2 + fixup.start * 2) +
          addr.substr(2) +
          bytecode.substr(2 + (fixup.start + fixup.length) * 2);
      }
    }
  }

  return bytecode;
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  // @ts-ignore
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { owner } = await getNamedAccounts();

  const poseidonT3ABI = poseidonContract.generateABI(2);
  const poseidonT3Bytecode = poseidonContract.createCode(2);
  const poseidonT5ABI = poseidonContract.generateABI(4);
  const poseidonT5Bytecode = poseidonContract.createCode(4);
  const poseidonT6ABI = poseidonContract.generateABI(5);
  const poseidonT6Bytecode = poseidonContract.createCode(5);

  await deploy("PoseidonT3Lib", {
    from: owner,
    contract: {
      abi: poseidonT3ABI,
      bytecode: poseidonT3Bytecode,
    },
    log: true,
    deterministicDeployment: true,
  });

  await deploy("PoseidonT5Lib", {
    from: owner,
    contract: {
      abi: poseidonT5ABI,
      bytecode: poseidonT5Bytecode,
    },
    log: true,
    deterministicDeployment: true,
  });

  await deploy("PoseidonT6Lib", {
    from: owner,
    contract: {
      abi: poseidonT6ABI,
      bytecode: poseidonT6Bytecode,
    },
    log: true,
    deterministicDeployment: true,
  });
};

export default func;
func.tags = ["PoseidonLibs"];
