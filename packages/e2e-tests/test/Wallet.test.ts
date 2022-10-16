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
  SimpleERC20Token__factory,
  Vault,
  Wallet,
} from "@flax/contracts";
import { SimpleERC20Token } from "@flax/contracts/dist/src/SimpleERC20Token";

import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
import * as fs from "fs";
import {
  BinaryPoseidonTree,
  FlaxPrivKey,
  FlaxSigner,
  proveSpend2,
  verifySpend2Proof,
  MerkleProofInput,
  NoteInput,
  FlaxAddressInput,
  Spend2Inputs,
  SNARK_SCALAR_FIELD,
} from "@flax/sdk";
import { poseidon } from "circomlibjs";

const circomlibjs = require("circomlibjs");
const poseidonContract = circomlibjs.poseidon_gencontract;

const ERC20_ID = SNARK_SCALAR_FIELD - 1n;

describe("Wallet", async () => {
  let deployer: ethers.Signer, alice: ethers.Signer, bob: ethers.Signer;
  let vault: Vault, wallet: Wallet, token: SimpleERC20Token;
  let flaxSigner: FlaxSigner;

  async function setup() {
    const sk = BigInt(1);
    const flaxPrivKey = new FlaxPrivKey(sk);
    const vk = flaxPrivKey.vk;
    flaxSigner = new FlaxSigner(flaxPrivKey);

    [deployer, alice, bob] = await ethers.getSigners();
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

    const tokenFactory = new SimpleERC20Token__factory(deployer);
    token = await tokenFactory.deploy();

    const vaultFactory = new Vault__factory(deployer);
    vault = await vaultFactory.deploy();

    const verifierFactory = new Spend2Verifier__factory(deployer);
    const verifier = await verifierFactory.deploy();

    const merkleFactory = new PoseidonBatchBinaryMerkle__factory(deployer);
    const merkle = await merkleFactory.deploy(32, 0, poseidonT3Lib.address);

    const walletFactory = new Wallet__factory(deployer);
    wallet = await walletFactory.deploy(
      vault.address,
      verifier.address,
      merkle.address,
      poseidonHasherT5.address,
      poseidonHasherT6.address
    );

    await vault.initialize(wallet.address);
  }

  async function aliceDepositFunds() {
    token.reserveTokens(alice.address, 1000);
    await token.connect(alice).approve(vault.address, 800);

    for (let i = 0; i < 8; i++) {
      await wallet.connect(alice).depositFunds({
        spender: alice.address as string,
        asset: token.address,
        value: 100,
        id: ERC20_ID,
        depositAddr: {
          H1X: flaxSigner.address.h1[0],
          H1Y: flaxSigner.address.h1[1],
          H2X: flaxSigner.address.h2[0],
          H2Y: flaxSigner.address.h2[1],
        },
      });
    }
  }

  beforeEach(async () => {
    await setup();
  });

  it("Test", async () => {
    await aliceDepositFunds();
    await wallet.commit8FromQueue();
  });
});
