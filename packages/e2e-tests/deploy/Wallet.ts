import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
const circomlibjs = require("circomlibjs");
const poseidonContract = circomlibjs.poseidonContract;

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  // @ts-ignore
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { owner } = await getNamedAccounts();

  const pairingLib = await deploy("PairingLib", {
    from: owner,
    contract: "Pairing",
    log: true,
  });

  const TestVerifier = await deploy("TestVerifier", {
    from: owner,
    libraries: {
      Pairing: pairingLib.address,
    },
    log: true,
  });

  const poseidonT3ABI = poseidonContract.generateABI(2);
  const poseidonT3Bytecode = poseidonContract.createCode(2);
  const poseidonT4ABI = poseidonContract.generateABI(3);
  const poseidonT4Bytecode = poseidonContract.createCode(3);
  const poseidonT6ABI = poseidonContract.generateABI(5);
  const poseidonT6Bytecode = poseidonContract.createCode(5);

  const poseidon3Lib = await deploy("PoseidonT3Lib", {
    from: owner,
    contract: {
      abi: poseidonT3ABI,
      bytecode: poseidonT3Bytecode,
    },
    log: true,
  });

  const poseidon4Lib = await deploy("PoseidonT4Lib", {
    from: owner,
    contract: {
      abi: poseidonT4ABI,
      bytecode: poseidonT4Bytecode,
    },
    log: true,
  });

  const poseidon6Lib = await deploy("PoseidonT6Lib", {
    from: owner,
    contract: {
      abi: poseidonT6ABI,
      bytecode: poseidonT6Bytecode,
    },
    log: true,
  });

  const binaryTreeLib = await deploy("BatchBinaryMerkleTree", {
    from: owner,
    contract: "BatchBinaryMerkleTree",
    libraries: {
      PoseidonT3: poseidon3Lib.address,
    },
    log: true,
  });

  const Vault = await deploy("Vault", {
    from: owner,
    contract: "Vault",
    log: true,
  });

  await deploy("Wallet", {
    from: owner,
    libraries: {
      BatchBinaryMerkleTree: binaryTreeLib.address,
      PoseidonT4: poseidon4Lib.address,
      PoseidonT6: poseidon6Lib.address,
    },
    args: [Vault.address, TestVerifier.address],
    log: true,
  });
};

export default func;
func.tags = ["Wallet"];
