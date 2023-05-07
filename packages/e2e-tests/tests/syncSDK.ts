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
import { makeTestLogger } from "@nocturne-xyz/offchain-utils";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import { SyncSubtreeSubmitter } from "@nocturne-xyz/subtree-updater/dist/src/submitter";
import { KEYS_TO_WALLETS } from "../src/keys";

// 10^9 (e.g. 10 gwei if this was eth)
const GAS_PRICE = 10n * 10n ** 9n;
// 10^9 gas
const GAS_FAUCET_DEFAULT_AMOUNT = 10_000_000n * GAS_PRICE; // 100M gwei

const ONE_DAY_SECONDS = 60n * 60n * 24n;

describe(
  "syncing NocturneWalletSDK with RPCSyncAdapter",
  syncTestSuite(SyncAdapterOption.RPC)
);
describe(
  "syncing NocturneWalletSDK with SubgraphSyncAdapter",
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
    const logger = makeTestLogger("subtree-updater", "updater");

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

      const [_aliceEoa] = KEYS_TO_WALLETS(provider);
      aliceEoa = _aliceEoa;

      token = testDeployment.tokens.erc20;
      console.log("token deployed at: ", token.address);

      gasToken = testDeployment.tokens.gasToken;
      console.log("gas Token deployed at: ", gasToken.address);

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
      await updater.init(logger);
    }

    async function applySubtreeUpdate() {
      const tx = await handler.fillBatchWithZeros();
      await tx.wait(1);
      await updater.pollInsertionsAndTryMakeBatch(logger);
      await updater.tryGenAndSubmitProofs(logger);
      // wait for subgraph
      await sleep(2_000);
    }

    afterEach(async () => {
      await updater.dropDB();
      await teardown();
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
      expect(nocturneWalletSDKAlice.merkleProver.count()).to.eql(2);
      expect(
        //@ts-ignore
        BigInt(nocturneWalletSDKAlice.merkleProver.getProof(0).leaf)
      ).to.equal(ncs[0]);
      expect(
        //@ts-ignore
        BigInt(nocturneWalletSDKAlice.merkleProver.getProof(1).leaf)
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
        .chainId(BigInt((await provider.getNetwork()).chainId))
        .deadline(
          BigInt((await provider.getBlock("latest")).timestamp) +
            ONE_DAY_SECONDS
        )
        .build();

      console.log("preparing op...");
      const preSign = await nocturneWalletSDKAlice.prepareOperation(opRequest);
      const signed = nocturneWalletSDKAlice.signOperation(preSign);
      console.log("proving op...");
      const op = await proveOperation(joinSplitProver, signed);

      console.log("submitting op...");
      await submitAndProcessOperation(op);

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

      // check that the merkle prover marked spent note's commitment for pruning
      // the spent note was inserted first, at merkle index 0
      //@ts-ignore
      expect(nocturneWalletSDKAlice.merkleProver.leaves.has(0)).to.be.false;
    });
  };
}
