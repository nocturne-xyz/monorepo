import {
  FlaxContext,
  FlaxPrivKey,
  FlaxSigner,
  IncludedNoteStruct,
  LocalFlaxDB,
  LocalMerkleProver,
  MockNotesManager,
  MockSpend2Prover,
} from "@flax/sdk";
import { ethers } from "ethers";
import { OnRpcRequestHandler } from "@metamask/snap-types";
import { SnapDB } from "./snapdb";

/**
 * Get a message from the origin. For demonstration purposes only.
 *
 * @param originString - The origin string.
 * @returns A message based on the origin.
 */
export const getMessage = (originString: string): string =>
  `Hello, ${originString}!`;

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
  const db = new SnapDB();
  const flaxPrivKey = new FlaxPrivKey(1n);
  const signer = new FlaxSigner(flaxPrivKey);
  const flaxAddr = signer.address;
  const context = new FlaxContext(
    signer,
    new MockSpend2Prover(),
    new LocalMerkleProver(
      "0x1234",
      new ethers.providers.JsonRpcProvider("https:/alchemy.com"),
      new LocalFlaxDB()
    ),
    new MockNotesManager(),
    db
  );

  // Old note input to spend
  const oldNote: IncludedNoteStruct = {
    owner: flaxAddr.toStruct(),
    nonce: 1n,
    asset: "0aaaa",
    value: 100n,
    id: 5n,
    merkleIndex: 0,
  };

  switch (request.method) {
    case "hello":
      return wallet.request({
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
    case "setAndShowKv":
      await context.db.storeNote(oldNote);
      const retrieved = await db.getNotesFor({
        address: oldNote.asset,
        id: oldNote.id,
      });
      return wallet.request({
        method: "snap_confirm",
        params: [
          {
            prompt: getMessage(origin),
            description: `Displaying newly set storage for ${{
              address: oldNote.asset,
              id: oldNote.id,
            }}`,
            textAreaContent: retrieved[0].asset,
          },
        ],
      });
    default:
      throw new Error("Method not found.");
  }
};
