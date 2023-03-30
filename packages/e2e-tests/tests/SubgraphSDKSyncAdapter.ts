import { expect } from "chai";
import { ethers } from "ethers";
import { open } from "lmdb";
import {
  DepositManager,
  Handler,
  SimpleERC20Token__factory,
} from "@nocturne-xyz/contracts";
import { SubtreeUpdater } from "@nocturne-xyz/subtree-updater";
import {
  SDKSyncAdapter,
  SubgraphSDKSyncAdapter,
  NocturneViewer,
  NoteTrait,
  IncludedNote,
} from "@nocturne-xyz/sdk";
import { setupTestDeployment, SUBGRAPH_URL } from "../src/deploy";
import { depositFundsSingleToken } from "../src/deposit";
import { getSubtreeUpdateProver, sleep } from "../src/utils";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import { SyncSubtreeSubmitter } from "@nocturne-xyz/subtree-updater/dist/src/submitter";
import { KEYS_TO_WALLETS } from "../src/keys";

describe("SDKSubgraphSyncAdapter", async () => {
  let teardown: () => Promise<void>;

  let aliceEoa: ethers.Wallet;

  let depositManager: DepositManager;
  let handler: Handler;
  let token: SimpleERC20Token;
  let updater: SubtreeUpdater;
  let syncAdapter: SDKSyncAdapter;
  let viewer: NocturneViewer;
  let provider: ethers.providers.Provider;

  beforeEach(async () => {
    // only doing deposits, so don't need bundler
    // using standalone subtree updater, so don't need subtree updater
    ({ teardown, aliceEoa, provider, depositManager, handler, provider } =
      await setupTestDeployment({
        include: {
          subgraph: true,
          depositScreener: true,
        },
      }));

    syncAdapter = new SubgraphSDKSyncAdapter(SUBGRAPH_URL);
    viewer = new NocturneViewer(2n);

    const [deployerEoa] = KEYS_TO_WALLETS(provider);
    token = await new SimpleERC20Token__factory(deployerEoa).deploy();
    console.log("Token deployed at: ", token.address);

    await newSubtreeUpdater();
  });

  async function newSubtreeUpdater() {
    const serverDB = open({ path: `${__dirname}/../db/merkleTestDB` });
    const prover = getSubtreeUpdateProver();
    const submitter = new SyncSubtreeSubmitter(handler);
    updater = new SubtreeUpdater(handler, serverDB, prover, submitter);
    await updater.init();
  }

  async function applySubtreeUpdate() {
    const tx = await handler.fillBatchWithZeros();
    await tx.wait(1);
    await updater.pollInsertionsAndTryMakeBatch();
    await updater.tryGenAndSubmitProofs();

    // wait for subgraph
    await sleep(2_000);
  }

  afterEach(async () => {
    await updater.dropDB();
    await teardown();
  });

  it("pulls only data for the given block range", async () => {
    // deposit a bunch of notes
    await depositFundsSingleToken(
      depositManager,
      token,
      aliceEoa,
      viewer.generateRandomStealthAddress(),
      [100n, 100n, 100n]
    );
    await applySubtreeUpdate();
    const firstRangeEndBlockExpected = await provider.getBlockNumber();

    // wait for subgraph
    await sleep(3_000);

    // check that diffs include 3 notes
    // check that there's no duplicate notes
    // check that endBlock is correct
    const notesFirstRange = new Set();
    let firstRangeEndBlock = 0;
    {
      const diffs = syncAdapter.iterStateDiffs(0, {
        endBlock: firstRangeEndBlockExpected,
      });
      for await (const { notes, blockNumber } of diffs.iter) {
        notes.forEach((note) => {
          expect(NoteTrait.isEncryptedNote(note)).to.be.false;
          const commitment = NoteTrait.toCommitment(note as IncludedNote);

          expect(notesFirstRange.has(commitment)).to.be.false;
          notesFirstRange.add(commitment);
        });
        firstRangeEndBlock = blockNumber;
      }
      expect(firstRangeEndBlock).to.equal(firstRangeEndBlockExpected);
      expect(notesFirstRange.size).to.equal(3);
    }

    // deposit more notes
    await depositFundsSingleToken(
      depositManager,
      token,
      aliceEoa,
      viewer.generateRandomStealthAddress(),
      [200n, 200n, 200n, 200n]
    );
    await applySubtreeUpdate();

    const secondRangeEndBlockExpected = await provider.getBlockNumber();
    // wait for subgraph
    await sleep(3_000);

    // check that diffs include 4 notes
    // check that there's no duplicate notes
    // check that none of the notes were in the previous range
    // check the `blockNumber` of every diff > firstRangeEndBlock
    // check that endBlock is correct
    const notesSecondRange = new Set();
    let secondRangeEndBlock = 0;
    {
      const diffs = syncAdapter.iterStateDiffs(firstRangeEndBlock, {
        endBlock: secondRangeEndBlockExpected,
      });
      for await (const { notes, blockNumber } of diffs.iter) {
        notes.forEach((note) => {
          expect(NoteTrait.isEncryptedNote(note)).to.be.false;
          const commitment = NoteTrait.toCommitment(note as IncludedNote);

          expect(notesSecondRange.has(commitment)).to.be.false;
          expect(notesFirstRange.has(commitment)).to.be.false;
          notesSecondRange.add(commitment);
        });

        expect(blockNumber).to.be.greaterThan(firstRangeEndBlock);
        secondRangeEndBlock = blockNumber;
      }
      expect(secondRangeEndBlock).to.equal(secondRangeEndBlockExpected);
      expect(notesSecondRange.size).to.equal(4);
    }
  });
});
