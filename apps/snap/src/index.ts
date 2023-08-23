import { getBIP44AddressKeyDeriver } from "@metamask/key-tree";
import { OnRpcRequestHandler } from "@metamask/snaps-types";
import { heading, panel, text } from "@metamask/snaps-ui";
import {
  NocturneSigner,
  SnapRpcRequestHandlerArgs,
  RpcRequestMethod,
  parseObjectValues,
  signOperation,
  assertAllRpcMethodsHandled,
} from "@nocturne-xyz/core";
import * as JSON from "bigint-json-serialization";
import { ethers } from "ethers";
import { makeSignOperationContent } from "./utils/display";
import { loadNocturneConfigBuiltin } from "@nocturne-xyz/config";

// To build locally, invoke `yarn build:local` from snap directory
// Sepolia

const NOCTURNE_BIP44_COINTYPE = 6789;
const config = loadNocturneConfigBuiltin("sepolia");

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

  const signer = await getNocturneSignerFromBIP44();

  console.log("Switching on method: ", request.method);
  console.log("Request Params:", request.params);
  switch (request.method) {
    case "nocturne_requestViewingKey":
      const viewer = signer.viewer();
      return {
        vk: viewer.vk,
        vkNonce: viewer.vkNonce,
      };
    case "nocturne_signOperation":
      console.log("Request params: ", request.params);

      const { op, metadata } = request.params;
      const contentItems = makeSignOperationContent(
        // specifies nothing about ordering
        metadata ?? { items: [] },
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
        throw new Error("snap request rejected by user");
      }

      console.log("signing operation:", op);
      try {
        const signedOp = await signOperation(signer, op);
        console.log(
          "PreProofOperationInputsAndProofInputs: ",
          JSON.stringify(signedOp)
        );
        return signedOp;
      } catch (err) {
        console.log("Error getting pre-proof operation:", err);
        throw err;
      }
    default:
      assertAllRpcMethodsHandled(request);
  }
}
