import { expect } from "chai";
import { ethers } from "ethers";
import {
  DepositManager,
  SimpleERC20Token__factory,
  Teller,
} from "@nocturne-xyz/contracts";
import {
  AssetType,
  JoinSplitProver,
  NocturneClient,
  proveOperation,
  newOpRequestBuilder,
  NoteTrait,
  unzip,
  NocturneSigner,
  signOperation,
} from "@nocturne-xyz/core";
import {
  SyncAdapterOption,
  setupTestDeployment,
  setupTestClient,
} from "../src/deploy";
import {
  depositFundsMultiToken,
  depositFundsSingleToken,
} from "../src/deposit";
import { sleep, submitAndProcessOperation } from "../src/utils";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import { KEYS_TO_WALLETS } from "../src/keys";

// 10^9 (e.g. 10 gwei if this was eth)
const GAS_PRICE = 10n * 10n ** 9n;
// 10^9 gas
const GAS_FAUCET_DEFAULT_AMOUNT = 10_000_000n * GAS_PRICE; // 100M gwei

const ONE_DAY_SECONDS = 60n * 60n * 24n;

describe(
  "syncing NocturneClient with RPCSyncAdapter",
  syncTestSuite(SyncAdapterOption.RPC)
);
describe(
  "syncing NocturneClient with SubgraphSyncAdapter",
  syncTestSuite(SyncAdapterOption.SUBGRAPH)
);

function syncTestSuite(syncAdapter: SyncAdapterOption) {
  return async () => {
    let teardown: () => Promise<void>;
    let fillSubtreeBatch: () => Promise<void>;
    let provider: ethers.providers.Provider;

    let aliceEoa: ethers.Wallet;

    let teller: Teller;
    let depositManager: DepositManager;
    let token: SimpleERC20Token;
    let gasToken: SimpleERC20Token;
    let nocturneSignerAlice: NocturneSigner;
    let nocturneClientAlice: NocturneClient;

    let joinSplitProver: JoinSplitProver;

    beforeEach(async () => {
      const testDeployment = await setupTestDeployment({
        include: {
          bundler: true,
          subgraph: true,
          depositScreener: true,
          subtreeUpdater: true,
        },
      });

      ({ teardown, provider, depositManager, teller, fillSubtreeBatch } =
        testDeployment);

      const [_aliceEoa] = KEYS_TO_WALLETS(provider);
      aliceEoa = _aliceEoa;

      token = testDeployment.tokens.erc20;
      console.log("token deployed at: ", token.address);

      gasToken = testDeployment.tokens.gasToken;
      console.log("gas Token deployed at: ", gasToken.address);

      ({ nocturneClientAlice, nocturneSignerAlice, joinSplitProver } =
        await setupTestClient(testDeployment.config, provider, {
          syncAdapter,
          gasAssets: new Map([["GAS", gasToken.address]]),
        }));
    });

    afterEach(async () => {
      await teardown();
    });

    it("syncs notes and latest non-zero leaves after subtree update", async () => {
      // deposit notes...
      const depositRequestsAndNotes = await depositFundsSingleToken(
        depositManager,
        token,
        aliceEoa,
        nocturneClientAlice.viewer.generateRandomStealthAddress(),
        [100n, 100n]
      );

      const depositedNotes = unzip(depositRequestsAndNotes)[1];
      const ncs = depositedNotes.map(NoteTrait.toCommitment);

      // force subtree update by filling batch and sync SDK
      await fillSubtreeBatch();
      await nocturneClientAlice.sync();

      // check that DB has notes and merkle has leaves for them
      //@ts-ignore
      const allNotes = await nocturneClientAlice.db.getAllNotes();
      const notes = Array.from(allNotes.values()).flat();
      expect(notes.length).to.eql(2);

      //@ts-ignore
      expect(nocturneClientAlice.merkleProver.count()).to.eql(2);
      expect(
        //@ts-ignore
        BigInt(nocturneClientAlice.merkleProver.getProof(0).leaf)
      ).to.equal(ncs[0]);
      expect(
        //@ts-ignore
        BigInt(nocturneClientAlice.merkleProver.getProof(1).leaf)
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
        nocturneClientAlice.viewer.generateRandomStealthAddress()
      );

      // force subtree update by filling batch and sync SDK...
      console.log("applying subtree update...");
      await fillSubtreeBatch();

      await sleep(2000);

      console.log("syncing SDK...");
      await nocturneClientAlice.sync();

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

      const chainId = BigInt((await provider.getNetwork()).chainId);
      const builder = newOpRequestBuilder({
        chainId,
        tellerContract: teller.address,
      });
      const opRequest = await builder
        .unwrap(asset, 80n)
        .action(token.address, transfer)
        .gasPrice(GAS_PRICE)
        .deadline(
          BigInt((await provider.getBlock("latest")).timestamp) +
            ONE_DAY_SECONDS
        )
        .build();

      console.log("preparing op...");
      const preSign = await nocturneClientAlice.prepareOperation(
        opRequest.request
      );
      const signed = signOperation(nocturneSignerAlice, preSign);
      console.log("proving op...");
      const op = await proveOperation(joinSplitProver, signed);

      console.log("submitting op...");
      await submitAndProcessOperation(op);

      console.log("apply subtree update post-operation...");
      await fillSubtreeBatch();

      await sleep(5000);

      // sync SDK again...
      console.log("syncing SDK again...");
      await nocturneClientAlice.sync();

      // check that the DB nullified the spent note
      // after the op, the 80 token note should be nullified, so they should have
      // no non-zero notes for `token`
      //@ts-ignore
      const notesForToken = await nocturneClientAlice.db.getNotesForAsset({
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
      expect(nocturneClientAlice.merkleProver.leaves.has(0)).to.be.false;
    });
  };
}
