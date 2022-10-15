import "@nomiclabs/hardhat-ethers";
import { ethers, deployments } from "hardhat";
import { expect } from "chai";
import * as contracts from "@flax/contracts";

describe("Wallet", async () => {
  beforeEach(async () => {
    const c = contracts;
    console.log(c);
  });

  it("Test", async () => {
    // const wallet = ethers.getContractAt("Wallet");
    // console.log(hre);
  });
});
