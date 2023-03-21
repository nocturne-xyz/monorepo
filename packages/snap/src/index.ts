import {
  NocturneWalletSDK,
  NocturneSigner,
  InMemoryMerkleProver,
  OperationRequest,
  NocturneDB,
  // RPCSyncAdapter,
  SubgraphSyncAdapter,
} from "@nocturne-xyz/sdk";
import { BabyJubJub } from "@nocturne-xyz/circuit-utils";
import { ethers } from "ethers";
import { getBIP44AddressKeyDeriver } from "@metamask/key-tree";
import { OnRpcRequestHandler } from "@metamask/snaps-types";
import { SnapKvStore } from "./snapdb";
import * as JSON from "bigint-json-serialization";
import {
  NocturneConfig,
  NocturneContractDeployment,
} from "@nocturne-xyz/config";

const WALLET_ADDRESS = "";
const START_BLOCK = 0;
const RPC_URL = "http://127.0.0.1:8545/";
const SUBGRAPH_API_URL = "http://127.0.0.1:8000/subgraphs/name/nocturne-test";

const DUMMY_CONTRACT_DEPLOYMENT: NocturneContractDeployment = {
  startBlock: 0,
  network: {
    name: "hardhat",
    chainId: 31337,
  },
  proxyAdmin: "0x0000000000000000000000000000000000000000",
  proxyAdminOwner: "0x0000000000000000000000000000000000000000",
  walletProxy: {
    kind: "Transparent",
    proxy: WALLET_ADDRESS,
    implementation: "0x0000000000000000000000000000000000000000",
  },
  vaultProxy: {
    kind: "Transparent",
    proxy: "0x0000000000000000000000000000000000000000",
    implementation: "0x0000000000000000000000000000000000000000",
  },
  joinSplitVerifier: "0x0000000000000000000000000000000000000000",
  subtreeUpdateVerifier: "0x0000000000000000000000000000000000000000",
};

const GAS_TOKEN_ADDRS = [
  "0x4e3df2073bf4b43B9944b8e5A463b1E185D6448C",
  "0xbfce6B877Ebff977bB6e80B24FbBb7bC4eBcA4df",
];

const DUMMY_CONFIG = new NocturneConfig(
  DUMMY_CONTRACT_DEPLOYMENT,
  new Map(GAS_TOKEN_ADDRS.map((addr, i) => [`TOKEN-${i}`, addr])),
  new Map()
);

const Fr = BabyJubJub.ScalarField;

/**
 * Get a message from the origin. For demonstration purposes only.
 *
 * @param originString - The origin string.
 * @returns A message based on the origin.
 */
const getMessage = (originString: string): string => `Hello, ${originString}!`;

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
 * @throws If the `snap_confirm` call failed.
 */
export const onRpcRequest: OnRpcRequestHandler = async ({
  origin,
  request,
}) => {
  const kvStore = new SnapKvStore();
  const nocturneDB = new NocturneDB(kvStore, { startBlock: START_BLOCK });
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

  const signer = await getNocturneSignerFromBIP44();
  console.log("Snap Nocturne Canonical Address: ", signer.canonicalAddress());

  const merkleProver = new InMemoryMerkleProver();
  // const syncAdapter = new RPCSyncAdapter(provider, WALLET_ADDRESS);
  const syncAdapter = new SubgraphSyncAdapter(SUBGRAPH_API_URL);
  const context = new NocturneWalletSDK(
    signer,
    provider,
    DUMMY_CONFIG,
    merkleProver,
    nocturneDB,
    syncAdapter
  );

  console.log("Switching on method: ", request.method);
  switch (request.method) {
    case "hello":
      return await snap.request({
        method: "snap_confirm",
        params: [
          {
            prompt: getMessage(origin),
            description:
              "This custom confirmation is just for display purposes.",
            textAreaContent:
              "But you can edit the snap source code to make it do something, if you want to!",
          },
        ],
      });
    case "nocturne_getRandomizedAddr":
      return JSON.stringify(signer.generateRandomStealthAddress());
    case "nocturne_getAllBalances":
      await context.sync({ skipMerkleProverUpdates: true });
      return JSON.stringify(await context.getAllAssetBalances());
    case "nocturne_sync":
      try {
        // set `skipMerkle` to true because we're not using the merkle tree during this RPC call
        await context.sync({ skipMerkleProverUpdates: true });
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

      await context.sync();

      const operationRequest = JSON.parse(
        (request.params as any).operationRequest
      ) as OperationRequest;

      // Ensure user has minimum balance for request
      if (
        !(await context.hasEnoughBalanceForOperationRequest(operationRequest))
      ) {
        throw new Error("Insufficient balance for operation request");
      }

      // Confirm spend sig auth
      await snap.request({
        method: "snap_confirm",
        params: [
          {
            prompt: `Confirm Spend Authorization`,
            description: `${origin}`,
            textAreaContent: JSON.stringify(operationRequest.joinSplitRequests),
          },
        ],
      });

      console.log("Operation request: ", operationRequest);

      // fetch gas price from chain and set it in the operation request if it's not already set
      if (!operationRequest.gasPrice) {
        const gasPrice = await provider.getGasPrice();
        operationRequest.gasPrice = gasPrice.toBigInt();
      }

      console.log("Operation gas price: ", operationRequest.gasPrice);

      try {
        const preSignOp = await context.prepareOperation(operationRequest);
        const signedOp = await context.signOperation(preSignOp);
        console.log(
          "PreProofOperationInputsAndProofInputs: ",
          JSON.stringify(signedOp)
        );
        return JSON.stringify(signedOp);
      } catch (err) {
        console.log("Error getting pre-proof operation:", err);
        throw err;
      }

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
