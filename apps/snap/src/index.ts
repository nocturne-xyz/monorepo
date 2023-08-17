import { getBIP44AddressKeyDeriver } from "@metamask/key-tree";
import { OnRpcRequestHandler } from "@metamask/snaps-types";
import { heading, panel, text } from "@metamask/snaps-ui";
import { loadNocturneConfigBuiltin } from "@nocturne-xyz/config";
import {
  BundlerOpTracker,
  GetNotesOpts,
  MockEthToTokenConverter,
  NocturneDB,
  NocturneSigner,
  NocturneWalletSDK,
  SparseMerkleProver,
  SubgraphSDKSyncAdapter,
  SyncOpts,
  Asset,
} from "@nocturne-xyz/core";
import { OperationMetadata, OperationRequest } from "@nocturne-xyz/core";
import * as JSON from "bigint-json-serialization";
import { ethers } from "ethers";
import { SnapKvStore } from "./snapdb";
import { makeSignOperationContent } from "./utils/display";

// To build locally, invoke `yarn build:local` from snap directory
// Sepolia
const RPC_URL =
  "https://eth-sepolia.g.alchemy.com/v2/0xjMuoUbPaLxWwD9EqOUFoJTuRh7qh0t";
const BUNDLER_URL = "https://bundler.testnet.nocturnelabs.xyz";
const SUBGRAPH_API_URL =
  "https://api.goldsky.com/api/public/project_cldkt6zd6wci33swq4jkh6x2w/subgraphs/nocturne/0.1.21-testnet/gn";
const config = loadNocturneConfigBuiltin("sepolia");

const NOCTURNE_BIP44_COINTYPE = 6789;
let snapIsSyncing = false;
let lastSyncedMerkleIndex: number | undefined;

async function getNocturneSignerFromBIP44(): Promise<NocturneSigner> {
  const nocturneNode = await snap.request({
    method: "snap_getBip44Entropy",
    params: {
      coinType: NOCTURNE_BIP44_COINTYPE,
    },
  });
  const addressKeyDeriver = await getBIP44AddressKeyDeriver(
    nocturneNode as any
  );
  const keyNode = await addressKeyDeriver(0);
  const sk = ethers.utils.keccak256(ethers.utils.arrayify(keyNode.privateKey!));
  const nocturnePrivKey = new NocturneSigner(ethers.utils.arrayify(sk));
  return nocturnePrivKey;
}

/**
 * Handle incoming JSON-RPC requests, sent through `wallet_invokeSnap`.
 *
 * @param args - The request handler args as object.
 * @param args.origin - The origin of the request, e.g., the website that
 * invoked the snap.
 * @param args.request - A validated JSON-RPC request object.
 * @returns `null` if the request succeeded.
 * @throws If the request method is not valid for this snap.
 * @throws If the `snap_dialog` call failed.
 */
export const onRpcRequest: OnRpcRequestHandler = async ({ request }) => {
  const kvStore = new SnapKvStore();
  const nocturneDB = new NocturneDB(kvStore);
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const signer = await getNocturneSignerFromBIP44();
  console.log("Snap Nocturne Canonical Address: ", signer.canonicalAddress());

  const merkleProver = await SparseMerkleProver.loadFromKV(kvStore);
  const syncAdapter = new SubgraphSDKSyncAdapter(SUBGRAPH_API_URL);
  const sdk = new NocturneWalletSDK(
    signer,
    provider,
    config,
    merkleProver,
    nocturneDB,
    syncAdapter,
    new MockEthToTokenConverter(),
    new BundlerOpTracker(BUNDLER_URL)
  );
  console.log("Config:", RPC_URL, BUNDLER_URL, SUBGRAPH_API_URL, config);
  console.log("Switching on method: ", request.method);
  // ! TODO we need better types on these, as any changes are breaking & only caught at runtime. also are very difficult to debug, since snap JSON RPC logs are unhelpful
  switch (request.method) {
    case "nocturne_getRandomizedAddr":
      return JSON.stringify(signer.generateRandomStealthAddress());
    case "nocturne_getAllBalances":
      console.log("Syncing...");
      await sdk.sync();

      const maybeGetNotesOptsAll = (request.params as any).opts;
      const getNotesOptsAll: GetNotesOpts | undefined = maybeGetNotesOptsAll
        ? JSON.parse(maybeGetNotesOptsAll)
        : undefined;
      return JSON.stringify(await sdk.getAllAssetBalances(getNotesOptsAll));
    // can return undefined
    case "nocturne_getBalanceForAsset":
      console.log("Syncing...");
      await sdk.sync();

      const maybeGetNotesOptsSingle = (request.params as any).opts;
      const getNotesOptsSingle: GetNotesOpts | undefined =
        maybeGetNotesOptsSingle
          ? JSON.parse(maybeGetNotesOptsSingle)
          : undefined;
      const asset: Asset = JSON.parse((request.params as any).asset);

      return JSON.stringify(
        await sdk.getBalanceForAsset(asset, getNotesOptsSingle)
      );
    case "nocturne_sync":
      if (snapIsSyncing) {
        console.log(
          "Snap is already syncing, returning last synced index, ",
          lastSyncedMerkleIndex
        );
        return lastSyncedMerkleIndex;
      }
      const maybeSyncOpts = (request.params as any).syncOpts;
      const syncOpts: SyncOpts | undefined = maybeSyncOpts
        ? JSON.parse(maybeSyncOpts)
        : undefined;

      console.log("Syncing", syncOpts);
      snapIsSyncing = true;
      let latestSyncedMerkleIndex: number | undefined;
      try {
        // set `skipMerkle` to true because we're not using the merkle tree during this RPC call
        latestSyncedMerkleIndex = await sdk.sync(syncOpts);
        await sdk.updateOptimisticNullifiers();
        console.log(
          "Synced. state is now: ",
          //@ts-ignore
          JSON.stringify(await kvStore.kv())
        );
      } catch (e) {
        console.log("Error syncing notes: ", e);
        throw e;
      } finally {
        snapIsSyncing = false;
      }
      console.log("latestSyncedMerkleIndex, ", latestSyncedMerkleIndex);
      lastSyncedMerkleIndex = latestSyncedMerkleIndex ?? lastSyncedMerkleIndex;
      return latestSyncedMerkleIndex;
    case "nocturne_getLatestSyncedMerkleIndex":
      return await sdk.getLatestSyncedMerkleIndex();
    case "nocturne_signOperation":
      console.log("Request params: ", request.params);

      await sdk.sync(); // NOTE: we should never end up in situation where this is called before normal nocturne_sync, otherwise there will be long delay
      await sdk.updateOptimisticNullifiers();

      console.log("done syncing");

      const operationRequest = JSON.parse(
        (request.params as any).request
      ) as OperationRequest;
      const opMetadata = JSON.parse(
        (request.params as any).meta
      ) as OperationMetadata;

      // Ensure user has minimum balance for request
      if (!(await sdk.hasEnoughBalanceForOperationRequest(operationRequest))) {
        throw new Error("Insufficient balance for operation request");
      }
      const contentItems = makeSignOperationContent(
        // specifies nothing about ordering
        opMetadata,
        config.erc20s
      ).flatMap((item) => {
        return [heading(item.heading), text(item.text)];
      });
      // Confirm spend sig auth
      const res = await snap.request({
        method: "snap_dialog",
        params: {
          type: "confirmation",
          content: panel(contentItems),
        },
      });

      if (!res) {
        throw new Error("Snap request rejected by user");
      }

      console.log("Operation request: ", operationRequest);
      try {
        const preSignOp = await sdk.prepareOperation(operationRequest);
        const signedOp = await sdk.signOperation(preSignOp);
        console.log(
          "PreProofOperationInputsAndProofInputs: ",
          JSON.stringify(signedOp)
        );

        await sdk.applyOptimisticRecordsForOp(signedOp, opMetadata);
        return JSON.stringify(signedOp);
      } catch (err) {
        console.log("Error getting pre-proof operation:", err);
        throw err;
      }
    case "nocturne_getInFlightOperations":
      const opDigestsAndMetadata =
        await sdk.getAllOptimisticOpDigestsWithMetadata();
      return JSON.stringify(opDigestsAndMetadata);
    case "nocturne_clearDb":
      await kvStore.clear();
      console.log(
        "Cleared DB, state: ",
        //@ts-ignore
        JSON.stringify(await kvStore.kv())
      );
      return;
    default:
      throw new Error("Method not found.");
  }
};