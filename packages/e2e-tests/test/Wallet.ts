import { resetHardhatContext } from "hardhat/plugins-testing";
import { expect } from "chai";
import { ethers, deployments } from "hardhat";
import { Address } from "hardhat-deploy/types";
const circomlibjs = require("circomlibjs");
const poseidonContract = circomlibjs.poseidon_gencontract;

describe("Wallet", async () => {
  async function setup() {
    await deployments.fixture(["Poseidon"]);

    const poseidonT3 = await ethers.getContract("PoseidonT3");
    const poseidonT5 = await ethers.getContract("PoseidonT5");
    const poseidonT6 = await ethers.getContract("PoseidonT6");

    return {
      poseidonT3,
      poseidonT5,
      poseidonT6,
    };
  }
  it("Test", async () => {
    const contracts = await setup();
    console.log(contracts);
  });
});
