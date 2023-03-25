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
  AssetType,
  JoinSplitProver,
  NocturneWalletSDK,
  proveOperation,
  OperationRequestBuilder,
  NoteTrait,
} from "@nocturne-xyz/sdk";
import {
  SyncAdapterOption,
  setupTestDeployment,
  setupTestClient,
} from "../src/deploy";
import {
  depositFundsMultiToken,
  depositFundsSingleToken,
} from "../src/deposit";
import {
  getSubtreeUpdateProver,
  sleep,
  submitAndProcessOperation,
} from "../src/utils";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import { SyncSubtreeSubmitter } from "@nocturne-xyz/subtree-updater/dist/src/submitter";
import { KEYS_TO_WALLETS } from "../src/keys";

// 10^9 (e.g. 10 gwei if this was eth)
const GAS_PRICE = 10n * 10n ** 9n;
// 10^9 gas
const GAS_FAUCET_DEFAULT_AMOUNT = 10n ** 9n * GAS_PRICE;

describe(
  "Syncing NocturneWalletSDK with RPCSyncAdapter",
  syncTestSuite(SyncAdapterOption.RPC)
);
describe(
  "Syncing NocturneWalletSDK with SubgraphSyncAdapter",
  syncTestSuite(SyncAdapterOption.SUBGRAPH)
);

function syncTestSuite(syncAdapter: SyncAdapterOption) {
  return async () => {
    let teardown: () => Promise<void>;
    let provider: ethers.providers.Provider;

    let aliceEoa: ethers.Wallet;

    let depositManager: DepositManager;
    let handler: Handler;
    let token: SimpleERC20Token;
    let gasToken: SimpleERC20Token;
    let nocturneWalletSDKAlice: NocturneWalletSDK;
    let updater: SubtreeUpdater;

    let joinSplitProver: JoinSplitProver;

    beforeEach(async () => {
      // don't deploy subtree updater, and don't deploy subgraph unless we're using SubgraphSyncAdapter
      const testDeployment = await setupTestDeployment({
        include: {
          bundler: true,
          subgraph: true,
          depositScreener: true,
        },
      });

      ({ teardown, provider, depositManager, handler } = testDeployment);

      const [deployerEoa, _aliceEoa] = KEYS_TO_WALLETS(provider);
      aliceEoa = _aliceEoa;

      token = await new SimpleERC20Token__factory(deployerEoa).deploy();
      console.log("Token deployed at: ", token.address);

      gasToken = await new SimpleERC20Token__factory(deployerEoa).deploy();
      console.log("Gas Token deployed at: ", gasToken.address);

      ({ nocturneWalletSDKAlice, joinSplitProver } = await setupTestClient(
        testDeployment.contractDeployment,
        provider,
        {
          syncAdapter,
          gasAssets: new Map([["GAS", gasToken.address]]),
        }
      ));

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
      await Promise.all([teardown(), updater.dropDB()]);
    });

    it("syncs notes, not leaves before subtree update", async () => {
      // deposit notes
      await depositFundsSingleToken(
        depositManager,
        token,
        aliceEoa,
        nocturneWalletSDKAlice.signer.generateRandomStealthAddress(),
        [100n, 100n]
      );
      // wait for subgraph
      await sleep(3_000);

      // sync SDK
      await nocturneWalletSDKAlice.sync();

      // check that DB has notes and merkle doesn't
      //@ts-ignore
      const allNotes = await nocturneWalletSDKAlice.db.getAllNotes();
      const notes = Array.from(allNotes.values()).flat();
      expect(notes.length).to.eql(2);

      //@ts-ignore
      expect(await nocturneWalletSDKAlice.merkleProver.count()).to.eql(0);
    });

    it("syncs notes and latest non-zero leaves after subtree update", async () => {
      // deposit notes...
      const depositedNotes = await depositFundsSingleToken(
        depositManager,
        token,
        aliceEoa,
        nocturneWalletSDKAlice.signer.generateRandomStealthAddress(),
        [100n, 100n]
      );
      // wait for subgraph
      await sleep(3_000);

      const ncs = depositedNotes.map(NoteTrait.toCommitment);

      // apply subtree update and sync SDK
      await applySubtreeUpdate();
      await nocturneWalletSDKAlice.sync();

      // check that DB has notes and merkle has leaves for them
      //@ts-ignore
      const allNotes = await nocturneWalletSDKAlice.db.getAllNotes();
      const notes = Array.from(allNotes.values()).flat();
      expect(notes.length).to.eql(2);

      //@ts-ignore
      expect(await nocturneWalletSDKAlice.merkleProver.count()).to.eql(2);
      expect(
        //@ts-ignore
        BigInt((await nocturneWalletSDKAlice.merkleProver.getProof(0)).leaf)
      ).to.equal(ncs[0]);
      expect(
        //@ts-ignore
        BigInt((await nocturneWalletSDKAlice.merkleProver.getProof(1)).leaf)
      ).to.equal(ncs[1]);
    });

    it("syncs nullifiers and nullifies notes", async () => {
      // deposit notes...
      console.log("depositing funds...");
      await depositFundsMultiToken(
        depositManager,
        [
          [token, [80n]],
          [gasToken, [GAS_FAUCET_DEFAULT_AMOUNT]],
        ],
        aliceEoa,
        nocturneWalletSDKAlice.signer.generateRandomStealthAddress()
      );
      // wait for subgraph
      await sleep(3_000);

      // apply subtree update and sync SDK...
      console.log("applying subtree update...");
      await applySubtreeUpdate();

      console.log("syncing SDK...");
      await nocturneWalletSDKAlice.sync();

      // spend one of them...
      const asset = {
        assetType: AssetType.ERC20,
        assetAddr: token.address,
        id: 0n,
      };

      const transfer =
        SimpleERC20Token__factory.createInterface().encodeFunctionData(
          "transfer",
          [await aliceEoa.getAddress(), 80n]
        );

      const builder = new OperationRequestBuilder();
      const opRequest = builder
        .unwrap(asset, 80n)
        .action(token.address, transfer)
        .gasPrice(GAS_PRICE)
        .build();

      console.log("preparing op...");
      const preSign = await nocturneWalletSDKAlice.prepareOperation(opRequest);
      const signed = nocturneWalletSDKAlice.signOperation(preSign);
      console.log("proving op...");
      const op = await proveOperation(joinSplitProver, signed);

      console.log("submitting op...");
      await submitAndProcessOperation(op);

      // wait for subgraph
      await sleep(2_000);

      // sync SDK again...
      console.log("syncing SDK again...");
      await nocturneWalletSDKAlice.sync();

      // check that the DB nullified the spent note
      // after the op, the 80 token note should be nullified, so they should have
      // no non-zero notes for `token`
      //@ts-ignore
      const notesForToken = await nocturneWalletSDKAlice.db.getNotesForAsset({
        assetType: AssetType.ERC20,
        assetAddr: token.address,
        id: 0n,
      });
      console.log("notesForToken: ", notesForToken);

      const nonZeroNotes = Array.from(notesForToken.values())
        .flat()
        .filter((note) => note.value > 0n);

      expect(nonZeroNotes).to.be.empty;
    });
  };
}
