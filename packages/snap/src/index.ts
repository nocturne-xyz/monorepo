import {
  NocturneWalletSDK,
  NocturneSigner,
  SparseMerkleProver,
  OperationRequest,
  NocturneDB,
  SubgraphSDKSyncAdapter,
  MockEthToTokenConverter,
  BundlerOpTracker,
  OperationMetadata,
} from "@nocturne-xyz/sdk";
import { BabyJubJub } from "@nocturne-xyz/circuit-utils";
import { ethers } from "ethers";
import { getBIP44AddressKeyDeriver } from "@metamask/key-tree";
import { OnRpcRequestHandler } from "@metamask/snaps-types";
import { SnapKvStore } from "./snapdb";
import * as JSON from "bigint-json-serialization";
import { loadNocturneConfigBuiltin } from "@nocturne-xyz/config";
import { panel, text, heading } from "@metamask/snaps-ui";
import { createLogger } from "winston";
import BrowserConsoleTransport from "winston-transport-browserconsole";
import { GetNotesOpts } from "@nocturne-xyz/sdk/dist/src/NocturneDB";

// Local
// const RPC_URL = "http://127.0.0.1:8545/";
// const BUNDLER_URL = "http://127.0.0.1:3000";
// const SUBGRAPH_API_URL = "http://127.0.0.1:8000/subgraphs/name/nocturne";
// const config = loadNocturneConfigBuiltin("localhost");

/**  https://docs.metamask.io/snaps/how-to/develop-a-snap/#publish-your-snap
 * At runtime, snaps are pulled down + installed from npm by the MM extension, where we have no control over environment.
 * So, we need to set the proper values for each environment manually.
 *  + we publish via tags, (yarn run publish:sepolia)
 *  and point the frontend at the appropriate tag for the snap to pull at run-time (this is already happening).
 *  ("npm:@nocturne-xyz/snap@sepolia" | "npm:@nocturne-xyz/snap@mainnet")
 */
// todo after ~6/27ish, change snap's "@nocturne-xyz/sdk" dep to workspace:^
// Sepolia
const RPC_URL =
  "https://eth-sepolia.g.alchemy.com/v2/0xjMuoUbPaLxWwD9EqOUFoJTuRh7qh0t";
const BUNDLER_URL = "https://bundler.nocturnelabs.xyz";
const SUBGRAPH_API_URL =
  "https://api.goldsky.com/api/public/project_cldkt6zd6wci33swq4jkh6x2w/subgraphs/nocturne/0.1.18-alpha/gn";
const config = loadNocturneConfigBuiltin("sepolia");

// logger
const LOG_LEVEL = "debug";
const logger = createLogger({
  exceptionHandlers: [new BrowserConsoleTransport()],
  rejectionHandlers: [new BrowserConsoleTransport()],
  transports: [new BrowserConsoleTransport({ level: LOG_LEVEL })],
});

const Fr = BabyJubJub.ScalarField;

const NOCTURNE_BIP44_COINTYPE = 6789;

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
  const sk = Fr.reduce(BigInt(keyNode.privateKey as string));
  const nocturnePrivKey = new NocturneSigner(sk);
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
export const onRpcRequest: OnRpcRequestHandler = async ({
  origin,
  request,
}) => {
  const kvStore = new SnapKvStore();
  const nocturneDB = new NocturneDB(kvStore);
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

  const signer = await getNocturneSignerFromBIP44();
  console.log("Snap Nocturne Canonical Address: ", signer.canonicalAddress());

  const merkleProver = await SparseMerkleProver.loadFromKV(kvStore);
  const syncAdapter = new SubgraphSDKSyncAdapter(SUBGRAPH_API_URL, logger);
  const sdk = new NocturneWalletSDK(
    signer,
    provider,
    config,
    merkleProver,
    nocturneDB,
    syncAdapter,
    new MockEthToTokenConverter(),
    new BundlerOpTracker(BUNDLER_URL),
    logger
  );

  console.log("Switching on method: ", request.method);
  switch (request.method) {
    case "nocturne_getRandomizedAddr":
      return JSON.stringify(signer.generateRandomStealthAddress());
    case "nocturne_getAllBalances":
      console.log("Syncing...");
      await sdk.sync();
      return JSON.stringify(
        await sdk.getAllAssetBalances(request.params as unknown as GetNotesOpts) // yikes typing
      );
    case "nocturne_sync":
      try {
        // set `skipMerkle` to true because we're not using the merkle tree during this RPC call
        await sdk.sync();
        await sdk.updateOptimisticNullifiers();
        console.log(
          "Synced. state is now: ",
          //@ts-ignore
          JSON.stringify(await kvStore.kv())
        );
      } catch (e) {
        console.log("Error syncing notes: ", e);
        throw e;
      }
      return;
    case "nocturne_signOperation":
      console.log("Request params: ", request.params);

      await sdk.sync();
      await sdk.updateOptimisticNullifiers();

      console.log("done syncing");

      const operationRequest = JSON.parse(
        (request.params as any).operationRequest
      ) as OperationRequest;

      const maybeMetadata = (request.params as any).opMetadata;
      const opMetadata: OperationMetadata | undefined = maybeMetadata
        ? JSON.parse(maybeMetadata)
        : undefined;

      // Ensure user has minimum balance for request
      if (!(await sdk.hasEnoughBalanceForOperationRequest(operationRequest))) {
        throw new Error("Insufficient balance for operation request");
      }

      // Confirm spend sig auth
      const res = await snap.request({
        method: "snap_dialog",
        params: {
          type: "confirmation",
          // TODO: make this UI better
          content: panel([
            heading(
              `${origin} would like to perform an operation via Nocturne`
            ),
            text(`operation request: ${JSON.stringify(operationRequest)}`),
          ]),
        },
      });

      if (!res) {
        throw new Error("rejected by user");
      }

      console.log("Operation request: ", operationRequest);

      // fetch gas price from chain and set it in the operation request if it's not already set
      if (!operationRequest.gasPrice) {
        const gasPrice = await provider.getGasPrice();
        operationRequest.gasPrice = gasPrice.toBigInt();
      }

      console.log("Operation gas price: ", operationRequest.gasPrice);

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
    case "nocturne_getInflightOpDigestsWithMetadata":
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
