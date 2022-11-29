import { OperationRequest, toJSON } from "@nocturne-xyz/sdk";
import { defaultSnapOrigin } from "../config";
import { GetSnapsResponse, Snap } from "../types";
/**
 * Get the installed snaps in MetaMask.
 *
 * @returns The snaps installed in MetaMask.
 */
export const getSnaps = async (): Promise<GetSnapsResponse> => {
  return (await window.ethereum.request({
    method: "wallet_getSnaps",
  })) as unknown as GetSnapsResponse;
};

/**
 * Connect a snap to MetaMask.
 *
 * @param snapId - The ID of the snap.
 * @param params - The params to pass with the snap to connect.
 */
export const connectSnap = async (
  snapId: string = defaultSnapOrigin,
  params: Record<"version" | string, unknown> = {}
) => {
  await window.ethereum.request({
    method: "wallet_enable",
    params: [
      {
        wallet_snap: {
          [snapId]: {
            ...params,
          },
        },
      },
    ],
  });
};

/**
 * Get the snap from MetaMask.
 *
 * @param version - The version of the snap to install (optional).
 * @returns The snap object returned by the extension.
 */
export const getSnap = async (version?: string): Promise<Snap | undefined> => {
  try {
    const snaps = await getSnaps();

    return Object.values(snaps).find(
      (snap) =>
        snap.id === defaultSnapOrigin && (!version || snap.version === version)
    );
  } catch (e) {
    console.log("Failed to obtain installed snap", e);
    return undefined;
  }
};

/**
 * Invoke the "hello" method from the example snap.
 */

export const sendHello = async () => {
  await window.ethereum.request({
    method: "wallet_invokeSnap",
    params: [
      defaultSnapOrigin,
      {
        method: "hello",
      },
    ],
  });
};

/**
 * Invoke the "hello" method from the example snap.
 */

export const sendSetAndShowKv = async () => {
  await window.ethereum.request({
    method: "wallet_invokeSnap",
    params: [
      defaultSnapOrigin,
      {
        method: "setAndShowKv",
      },
    ],
  });
};

export const syncNotes = async () => {
  await window.ethereum.request({
    method: "wallet_invokeSnap",
    params: [
      defaultSnapOrigin,
      {
        method: "flax_syncNotes",
      },
    ],
  });
};

export const syncLeaves = async () => {
  await window.ethereum.request({
    method: "wallet_invokeSnap",
    params: [
      defaultSnapOrigin,
      {
        method: "flax_syncLeaves",
      },
    ],
  });
};

export const generateProof = async (operationRequest: OperationRequest) => {
  console.log("Invoking flax_generateProof");
  const res = await window.ethereum.request({
    method: "wallet_invokeSnap",
    params: [
      defaultSnapOrigin,
      {
        method: "flax_generateProof",
        params: { operationRequest: toJSON(operationRequest) },
      },
    ],
  });

  return res;
};

export const clearDb = async () => {
  await window.ethereum.request({
    method: "wallet_invokeSnap",
    params: [
      defaultSnapOrigin,
      {
        method: "flax_clearDb",
      },
    ],
  });
};

export const isLocalSnap = (snapId: string) => snapId.startsWith("local:");
