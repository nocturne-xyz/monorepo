import { expect } from "chai";
import { ethers, deployments } from "hardhat";
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

import {
  BinaryPoseidonTree,
  FlaxPrivKey,
  FlaxSigner,
  Action,
  SNARK_SCALAR_FIELD,
  Bundle,
  Note,
  FlaxContext,
  AssetHash,
} from "@flax/sdk";
import { Asset, AssetRequest } from "@flax/sdk/dist/src/commonTypes";
import { SpendableNote } from "@flax/sdk/dist/src/sdk/note";
import { OperationRequest } from "@flax/sdk/dist/src/FlaxContext";

const ERC20_ID = SNARK_SCALAR_FIELD - 1n;
const PER_SPEND_AMOUNT = 100n;

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
    await deployments.fixture(["PoseidonLibs"]);

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
    await token.connect(alice).approve(vault.address, 200);

    for (let i = 0; i < 2; i++) {
      await wallet.connect(alice).depositFunds({
        spender: alice.address as string,
        asset: token.address,
        value: PER_SPEND_AMOUNT,
        id: ERC20_ID,
        depositAddr: flaxSigner.address.toFlattened(),
      });
    }
  }

  beforeEach(async () => {
    await setup();
  });

  it("Alice deposits two 100 token notes, spends one and transfers 50 tokens to Bob", async () => {
    console.log("Deposit funds and commit note commitments");
    await aliceDepositFunds();
    await wallet.commit2FromQueue();

    console.log("Create two corresponding notes from deposits");
    const firstOldNote = new Note({
      owner: flaxSigner.address.toFlattened(),
      nonce: 0n,
      asset: token.address,
      id: ERC20_ID,
      value: PER_SPEND_AMOUNT,
    });
    const secondOldNote = new Note({
      owner: flaxSigner.address.toFlattened(),
      nonce: 1n,
      asset: token.address,
      id: ERC20_ID,
      value: PER_SPEND_AMOUNT,
    });

    const asset = new Asset(token.address, ERC20_ID);

    console.log("Create corresponding note commitments");
    const firstOldNoteCommitment = firstOldNote.toCommitment();
    const secondOldNoteCommitment = secondOldNote.toCommitment();

    console.log("Replicate commitment tree state");
    const tree = new BinaryPoseidonTree();
    tree.insert(firstOldNoteCommitment);
    tree.insert(secondOldNoteCommitment);

    console.log("Generate merkle proofs for two notes");
    expect(tree.root()).to.equal((await wallet.getRoot()).toBigInt());
    const firstMerkleProof = tree.createProof(0);
    const secondMerkleProof = tree.createProof(1);

    console.log("Prefill tokenToNotes mapping for FlaxContext");
    const tokenToNotes: Map<AssetHash, SpendableNote[]> = new Map([
      [
        asset.hash(),
        [
          new SpendableNote(firstOldNote, firstMerkleProof),
          new SpendableNote(secondOldNote, secondMerkleProof),
        ],
      ],
    ]);

    console.log("Create FlaxContext");
    const flaxContext = new FlaxContext(flaxSigner.privkey, tokenToNotes, tree);

    console.log("Create asset request to spend 50 units of token");
    const assetRequest: AssetRequest = {
      asset,
      value: 50n,
    };

    console.log("Encode operation request");
    const refundTokens = [firstOldNote.asset];
    const encodedFunction =
      SimpleERC20Token__factory.createInterface().encodeFunctionData(
        "transfer",
        [bob.address, 50]
      );
    const action: Action = {
      contractAddress: token.address,
      encodedFunction: encodedFunction,
    };
    const operationRequest: OperationRequest = {
      assetRequests: [assetRequest],
      refundTokens,
      actions: [action],
    };

    console.log("Create post-proof operation with FlaxContext");
    const operation = await flaxContext.tryCreatePostProofOperation(
      operationRequest
    );

    const bundle: Bundle = {
      operations: [operation],
    };

    console.log("Process bundle");
    const res = await wallet.processBundle(bundle);

    expect((await token.balanceOf(alice.address)).toBigInt()).to.equal(800n);
    expect((await token.balanceOf(bob.address)).toBigInt()).to.equal(50n);
    expect((await token.balanceOf(vault.address)).toBigInt()).to.equal(150n);
  });
});
