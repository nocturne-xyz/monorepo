import { resetHardhatContext } from "hardhat/plugins-testing";
import { expect } from "chai";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import {
  Wallet__factory,
  Vault__factory,
  Spend2Verifier__factory,
  PoseidonBatchBinaryMerkle__factory,
  PoseidonHasherT3__factory,
  PoseidonHasherT5__factory,
  PoseidonHasherT6__factory,
} from "@flax/contracts";

const circomlibjs = require("circomlibjs");
const poseidonContract = circomlibjs.poseidon_gencontract;

describe("Wallet", async () => {
  let deployer: ethers.Signer;

  async function setup() {
    [deployer] = await ethers.getSigners();
    await deployments.fixture(["PoseidonLibs", "BatchBinaryMerkleLib"]);

    const poseidonT3Lib = await ethers.getContract("PoseidonT3Lib");
    const poseidonT5Lib = await ethers.getContract("PoseidonT5Lib");
    const poseidonT6Lib = await ethers.getContract("PoseidonT6Lib");

    const poseidonT3Factory = new PoseidonHasherT3__factory(deployer);
    const poseidonHasherT3 = await poseidonT3Factory.deploy(
      poseidonT3Lib.address
    );

    const poseidonT5Factory = new PoseidonHasherT5__factory(deployer);
    const poseidonHasherT5 = await poseidonT5Factory.deploy(
      poseidonT5Lib.address
    );

    const poseidonT6Factory = new PoseidonHasherT6__factory(deployer);
    const poseidonHasherT6 = await poseidonT6Factory.deploy(
      poseidonT6Lib.address
    );

    const vaultFactory = new Vault__factory(deployer);
    const vault = await vaultFactory.deploy();

    const verifierFactory = new Spend2Verifier__factory(deployer);
    const verifier = await verifierFactory.deploy();

    const merkleFactory = new PoseidonBatchBinaryMerkle__factory(deployer);
    const merkle = await merkleFactory.deploy(32, 0, poseidonT3Lib.address);

    const walletFactory = new Wallet__factory(deployer);
    const wallet = walletFactory.deploy(
      vault.address,
      verifier.address,
      merkle.address,
      poseidonHasherT5.address,
      poseidonHasherT6.address
    );

    return {
      vault,
      wallet,
    };
  }

  it("Test", async () => {
    const contracts = await setup();
    console.log(contracts);
  });
});
