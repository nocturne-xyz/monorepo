import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
const circomlibjs = require("circomlibjs");
const poseidonContract = circomlibjs.poseidon_gencontract;

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

  const poseidon3Lib = await deploy("PoseidonT3", {
    from: owner,
    contract: {
      abi: poseidonT3ABI,
      bytecode: poseidonT3Bytecode,
    },
    log: true,
    deterministicDeployment: true,
  });

  const poseidon5Lib = await deploy("PoseidonT5", {
    from: owner,
    contract: {
      abi: poseidonT5ABI,
      bytecode: poseidonT5Bytecode,
    },
    log: true,
    deterministicDeployment: true,
  });

  const poseidon6Lib = await deploy("PoseidonT6", {
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
func.tags = ["Poseidon"];
