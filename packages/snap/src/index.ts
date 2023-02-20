import {
  NocturneContext,
  NocturneSigner,
  InMemoryMerkleProver,
  DefaultNotesManager,
  OperationRequest,
  NotesDB,
  MerkleDB,
} from "@nocturne-xyz/sdk";
import { BabyJubJub } from "@nocturne-xyz/circuit-utils";
import { ethers } from "ethers";
import { getBIP44AddressKeyDeriver } from "@metamask/key-tree";
import { OnRpcRequestHandler } from "@metamask/snaps-types";
import { SnapKvStore } from "./snapdb";
import * as JSON from "bigint-json-serialization";

const WALLET_ADDRESS = "0xFEe587E68c470DAE8147B46bB39fF230A29D4769";
const START_BLOCK = 0;
// const RPC_URL =
//   "https://eth-goerli.g.alchemy.com/v2/meBVzK1NR_VyKM7wVmOHj1hAbakk4esk";
const RPC_URL = "http://127.0.0.1:8545/";

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
  const nocturneNode = await wallet.request({
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
  const notesDB = new NotesDB(kvStore);
  const merkleDB = new MerkleDB(kvStore);
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

  const signer = await getNocturneSignerFromBIP44();
  console.log("Snap Nocturne Canonical Address: ", signer.canonicalAddress());

  const notesManager = new DefaultNotesManager(
    notesDB,
    signer,
    WALLET_ADDRESS,
    provider,
    { startBlock: START_BLOCK }
  );

  const merkleProver = await InMemoryMerkleProver.fromDb(
    WALLET_ADDRESS,
    provider,
    merkleDB,
    { startBlock: START_BLOCK }
  );

  const context = new NocturneContext(
    signer,
    provider,
    WALLET_ADDRESS,
    merkleProver,
    notesManager,
    notesDB
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
      return JSON.stringify(signer.randomStealthAddress());
    case "nocturne_getAllBalances":
      return JSON.stringify(await context.getAllAssetBalances());
    case "nocturne_syncNotes":
      try {
        await context.syncNotes();
        console.log(
          "Synced notes, state: ",
          JSON.stringify(await kvStore.getState())
        );
      } catch (e) {
        console.log("Error syncing notes: ", e);
        throw e;
      }
      return;
    case "nocturne_syncLeaves":
      try {
        await context.syncLeaves();
        console.log(
          "Synced leaves, state: ",
          JSON.stringify(await kvStore.getState())
        );
      } catch (e) {
        console.log("Error syncing leaves: ", e);
        throw e;
      }

      return;
    case "nocturne_signOperation":
      console.log("Request params: ", request.params);
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
        JSON.stringify(await kvStore.getState())
      );
      return;
    default:
      throw new Error("Method not found.");
  }
};
