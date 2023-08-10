import { GetSnapOptions, GetSnapsResponse, Snap } from "./types";
import { SnapStateApi } from "../api";

const NOCTURNE_SNAP_ORIGIN = "npm:@nocturne-xyz/snap";

export class SnapStateSdk implements SnapStateApi {
  isFlask = async (): Promise<boolean> => {
    const provider = window.ethereum;

    try {
      const clientVersion = await provider?.request({
        method: "web3_clientVersion",
      });

      const isFlaskDetected = (clientVersion as string[])?.includes("flask");

      return Boolean(provider && isFlaskDetected);
    } catch {
      return false;
    }
  };

  connect = async ({
    version,
    snapId = NOCTURNE_SNAP_ORIGIN,
  }: GetSnapOptions): Promise<GetSnapsResponse> => {
    return (await window.ethereum.request({
      method: "wallet_requestSnaps",
      params: {
        [snapId]: {
          version,
        },
      },
    })) as unknown as GetSnapsResponse;
  };

  getSnap = async ({
    version,
    snapId = NOCTURNE_SNAP_ORIGIN,
  }: GetSnapOptions): Promise<Snap | undefined> => {
    try {
      const snaps = await this.getSnaps();

      return Object.values(snaps).find(
        (snap) => snap.id === snapId && (!version || snap.version === version)
      );
    } catch (e) {
      console.log("Failed to obtain installed snap", e);
      return undefined;
    }
  };

  clearDb = async (
    env: "development" | "testnet" | string,
    snapId = NOCTURNE_SNAP_ORIGIN
  ): Promise<void> => {
    if (env !== "development" && env !== "testnet") {
      throw new Error(
        "Method clearDb is only available in development and testnet"
      );
    }
    await window.ethereum.request({
      method: "wallet_invokeSnap",
      params: {
        snapId,
        request: {
          method: "nocturne_clearDb",
        },
      },
    });
  };

  /**
   * Get the installed snaps in MetaMask.
   * https://docs.metamask.io/snaps/reference/rpc-api/#wallet_getsnaps
   *
   * @returns The snaps installed in MetaMask.
   */
  protected getSnaps = async (): Promise<GetSnapsResponse> => {
    return (await window.ethereum.request({
      method: "wallet_getSnaps",
    })) as unknown as GetSnapsResponse;
  };
}
