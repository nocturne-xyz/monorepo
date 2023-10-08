import { OnRpcRequestHandler } from "@metamask/snaps-types";
import { heading, panel, text } from "@metamask/snaps-ui";
import {
  NocturneSigner,
  computeCanonAddrRegistryEntryDigest,
} from "@nocturne-xyz/core";
import {
  SnapRpcRequestHandlerArgs,
  RpcRequestMethod,
  parseObjectValues,
  signOperation,
  assertAllRpcMethodsHandled,
} from "@nocturne-xyz/client";
import * as JSON from "bigint-json-serialization";
import { ethers } from "ethers";
import {
  makeSignCanonAddrRegistryEntryContent,
  makeSignOperationContent,
} from "./utils/display";
import { loadNocturneConfigBuiltin } from "@nocturne-xyz/config";
import { SnapKvStore } from "./snapdb";

// To build locally, invoke `yarn build:local` from snap directory
// Goerli

const SPEND_KEY_DB_KEY = "nocturne_spend_key";

const config = loadNocturneConfigBuiltin("goerli");
const kvStore = new SnapKvStore();

async function getNocturneSignerFromDb(): Promise<NocturneSigner | undefined> {
  const spendKey = await kvStore.getString(SPEND_KEY_DB_KEY);
  if (!spendKey) {
    return undefined;
  }

  return new NocturneSigner(ethers.utils.arrayify(spendKey));
}

async function getSigner(): Promise<NocturneSigner> {
  // Attempt to get signer from db first, if empty get from bip44 which always returns a value
  const signer = await getNocturneSignerFromDb();
  if (!signer) {
    throw new Error("Nocturne key not set");
  }

  return signer;
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
export const onRpcRequest: OnRpcRequestHandler = async (args) => {
  try {
    const handledResponse = await handleRpcRequest(
      args as unknown as SnapRpcRequestHandlerArgs
    );
    return handledResponse ? JSON.stringify(handledResponse) : undefined;
  } catch (e) {
    console.error("Snap has thrown error for request: ", args.request);
    throw e;
  }
};

async function handleRpcRequest({
  request,
}: SnapRpcRequestHandlerArgs): Promise<RpcRequestMethod["return"]> {
  //@ts-ignore
  request.params = request.params
    ? parseObjectValues(request.params)
    : undefined;

  console.log("Switching on method: ", request.method);
  switch (request.method) {
    case "nocturne_spendKeyIsSet": {
      return await kvStore.containsKey(SPEND_KEY_DB_KEY);
    }
    case "nocturne_setSpendKey": {
      const spendKey = new Uint8Array(request.params.spendKey);

      // Can only set spend key if not already set, only way to reset is to clear snap db and
      // regenerate key
      // Return error string if spend key already set
      if (await kvStore.getString(SPEND_KEY_DB_KEY)) {
        return "Error: Spend key already set";
      }

      await kvStore.putString(SPEND_KEY_DB_KEY, ethers.utils.hexlify(spendKey));

      // Zero out spend key memory
      spendKey.fill(0);

      return;
    }
    case "nocturne_requestViewingKey": {
      const signer = await getSigner();
      const viewer = signer.viewer();
      return {
        vk: viewer.vk,
        vkNonce: viewer.vkNonce,
      };
    }
    case "nocturne_signCanonAddrRegistryEntry": {
      const signer = await getSigner();
      const { entry, chainId, registryAddress } = request.params;

      const { heading: registryHeading, text: registryText } =
        makeSignCanonAddrRegistryEntryContent(entry, chainId, registryAddress);
      const registryConfirmRes = await snap.request({
        method: "snap_dialog",
        params: {
          type: "confirmation",
          content: panel([heading(registryHeading), text(registryText)]),
        },
      });

      if (!registryConfirmRes) {
        throw new Error("snap request rejected by user");
      }

      const registryDigest = computeCanonAddrRegistryEntryDigest(
        entry,
        chainId,
        registryAddress
      );

      const canonAddr = signer.canonicalAddress();
      const registrySig = signer.sign(registryDigest);
      const spendPubkey = signer.spendPk;
      const vkNonce = signer.vkNonce;
      return {
        canonAddr,
        digest: registryDigest,
        sig: registrySig,
        spendPubkey,
        vkNonce,
      };
    }
    case "nocturne_signOperation": {
      const signer = await getSigner();
      const { op, metadata } = request.params;
      const contentItems = makeSignOperationContent(
        // specifies nothing about ordering
        metadata ?? { items: [] },
        config.erc20s
      ).flatMap((item) => {
        return [heading(item.heading), text(item.text)];
      });
      // Confirm spend sig auth
      const opConfirmRes = await snap.request({
        method: "snap_dialog",
        params: {
          type: "confirmation",
          content: panel(contentItems),
        },
      });

      if (!opConfirmRes) {
        throw new Error("snap request rejected by user");
      }

      try {
        const signedOp = signOperation(signer, op);
        return signedOp;
      } catch (err) {
        console.log("Error getting pre-proof operation:", err);
        throw err;
      }
    }
    default:
      assertAllRpcMethodsHandled(request);
  }
}
