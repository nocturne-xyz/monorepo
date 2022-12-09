import { expect } from "chai";
import { ethers, network } from "hardhat";
import { open } from "lmdb";
import {
  SimpleERC20Token__factory,
  Vault,
  Wallet,
} from "@nocturne-xyz/contracts";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";

import {
  Action,
  SNARK_SCALAR_FIELD,
  Bundle,
  NocturneContext,
  Asset,
  JoinSplitRequest,
  OperationRequest,
  NotesDB,
  LocalMerkleProver,
  MockSubtreeUpdateProver,
  query,
} from "@nocturne-xyz/sdk";
import { setup } from "../deploy/deployNocturne";
import { depositFunds } from "./utils";
import { OperationProcessedEvent } from "@nocturne-xyz/contracts/dist/src/Wallet";
import { SubtreeUpdater } from "@nocturne-xyz/subtree-updater";

const ERC20_ID = SNARK_SCALAR_FIELD - 1n;

// ALICE_UNWRAP_VAL + ALICE_TO_BOB_PRIV_VAL should be between PER_NOTE_AMOUNT
// and and 2 * PER_NOTE_AMOUNT
const PER_NOTE_AMOUNT = 100n;
const ALICE_UNWRAP_VAL = 120n;
const ALICE_TO_BOB_PUB_VAL = 100n;
const ALICE_TO_BOB_PRIV_VAL = 30n;

describe("Wallet", async () => {
  let deployer: ethers.Signer;
  let alice: ethers.Signer;
  let bob: ethers.Signer;
  let vault: Vault;
  let wallet: Wallet;
  let token: SimpleERC20Token;
  let updater: SubtreeUpdater;
  let notesDBAlice: NotesDB;
  let nocturneContextAlice: NocturneContext;
  let notesDBBob: NotesDB;
  let nocturneContextBob: NocturneContext;

  beforeEach(async () => {
    [deployer] = await ethers.getSigners();
    const tokenFactory = new SimpleERC20Token__factory(deployer);
    token = await tokenFactory.deploy();
    console.log("Token deployed at: ", token.address);

    ({
      alice,
      bob,
      vault,
      wallet,
      notesDBAlice,
      nocturneContextAlice,
      notesDBBob,
      nocturneContextBob,
    } = await setup());

    const serverDB = open({ path: `${__dirname}/../db/localMerkleTestDB` });
    const prover = new MockSubtreeUpdateProver();
    updater = new SubtreeUpdater(wallet, serverDB, prover);
    await updater.init();
  });

  async function applySubtreeUpdate() {
    await wallet.fillBatchWithZeros();
    await updater.pollInsertionsAndTryMakeBatch();
    await updater.tryGenAndSubmitProofs();
  }

  afterEach(async () => {
    await notesDBAlice.clear();
    await notesDBBob.clear();
    await updater.dropDB();
  });

  after(async () => {
    await network.provider.send("hardhat_reset");
  });

  it(`Alice deposits two 100 token notes, spends one and unwraps ${ALICE_UNWRAP_VAL} tokens publicly, ERC20 transfers ${ALICE_TO_BOB_PUB_VAL} to Bob, and pays ${ALICE_TO_BOB_PUB_VAL} to Bob privately`, async () => {
    const asset: Asset = { address: token.address, id: ERC20_ID };

    console.log("Deposit funds and commit note commitments");
    await depositFunds(
      wallet,
      vault,
      token,
      alice,
      nocturneContextAlice.signer.address,
      [PER_NOTE_AMOUNT, PER_NOTE_AMOUNT]
    );

    console.log("apply subtree update");

    await applySubtreeUpdate();
    await (
      nocturneContextAlice.merkleProver as LocalMerkleProver
    ).fetchLeavesAndUpdate();

    console.log("Alice: Sync SDK notes manager");
    await nocturneContextAlice.syncNotes();
    const notesForAlice = await nocturneContextAlice.db.getNotesFor(asset);
    expect(notesForAlice.length).to.equal(2);

    console.log("Bob: Sync SDK notes manager");
    await nocturneContextBob.syncNotes();
    const notesForBob = await nocturneContextBob.db.getNotesFor(asset);
    expect(notesForBob.length).to.equal(0);

    console.log("Sync SDK merkle prover");
    await nocturneContextAlice.syncLeaves();
    expect(
      (nocturneContextAlice.merkleProver as LocalMerkleProver).root()
    ).to.equal((await wallet.root()).toBigInt());

    console.log(
      "Alice: Create asset request to send tokens to Bob - 20 publicly and 30 privately."
    );
    const joinSplitRequest: JoinSplitRequest = {
      asset,
      unwrapValue: ALICE_UNWRAP_VAL,
      paymentIntent: {
        receiver: nocturneContextBob.signer.canonAddress,
        value: ALICE_TO_BOB_PRIV_VAL,
      },
    };

    console.log("Alice: Encode public ERC20 transfer to send 20 tokens Bob");
    const refundTokens = [token.address];
    const encodedFunction =
      SimpleERC20Token__factory.createInterface().encodeFunctionData(
        "transfer",
        [bob.address, ALICE_TO_BOB_PUB_VAL]
      );
    const action: Action = {
      contractAddress: token.address,
      encodedFunction: encodedFunction,
    };
    const operationRequest: OperationRequest = {
      joinSplitRequests: [joinSplitRequest],
      refundTokens,
      actions: [action],
    };

    console.log("Create post-proof operation with NocturneContext");
    const operation = await nocturneContextAlice.tryCreateProvenOperation(
      operationRequest
    );

    const bundle: Bundle = {
      operations: [operation],
    };

    console.log("Process bundle");
    await wallet.processBundle(bundle);

    console.log("Check for OperationProcessed event");
    const latestBlock = await ethers.provider.getBlockNumber();
    const events: OperationProcessedEvent[] = await query(
      wallet,
      wallet.filters.OperationProcessed(),
      0,
      latestBlock
    );
    expect(events.length).to.equal(1);
    expect(events[0].args.opSuccess).to.equal(true);
    expect(events[0].args.callSuccesses[0]).to.equal(true);

    expect((await token.balanceOf(alice.address)).toBigInt()).to.equal(
      1000n - 2n * PER_NOTE_AMOUNT
    );
    expect((await token.balanceOf(bob.address)).toBigInt()).to.equal(
      ALICE_TO_BOB_PUB_VAL
    );
    expect((await token.balanceOf(vault.address)).toBigInt()).to.equal(
      2n * PER_NOTE_AMOUNT - ALICE_TO_BOB_PUB_VAL
    );

    console.log("Alice: Sync SDK notes manager post-operation");
    await nocturneContextAlice.syncNotes();
    const updatedNotesAlice = await notesDBAlice.getNotesFor(asset)!;
    const nonZeroNotesAlice = updatedNotesAlice.filter((n) => n.value > 0n);
    // alcie should have two nonzero notes total
    expect(nonZeroNotesAlice.length).to.equal(2);

    // alice should have a note with refund value from public spendk
    let foundNotesAlice = nonZeroNotesAlice.filter((n) => n.value === ALICE_UNWRAP_VAL - ALICE_TO_BOB_PUB_VAL);
    expect(foundNotesAlice.length).to.equal(1);

    // alice should have another note with refund value from private payment to bob
    foundNotesAlice = nonZeroNotesAlice.filter((n) => n.value === 2n * PER_NOTE_AMOUNT - ALICE_UNWRAP_VAL - ALICE_TO_BOB_PRIV_VAL);
    expect(foundNotesAlice.length).to.equal(1);

    console.log("Bob: Sync SDK notes manager post-operation");
    await nocturneContextBob.syncNotes();
    const updatedNotesBob = await notesDBBob.getNotesFor(asset)!;
    const nonZeroNotesBob = updatedNotesBob.filter((n) => n.value > 0n);
    // bob should have one nonzero note total
    expect(nonZeroNotesBob.length).to.equal(1);

    // That one note should contain the tokens sent privately from alice
    expect(nonZeroNotesBob[0].value).to.equal(ALICE_TO_BOB_PRIV_VAL);
  });
});
