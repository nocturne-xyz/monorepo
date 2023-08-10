import { SnapStateApi } from "../api";
import { SupportedNetwork } from "../types";
import { GetSnapsResponse, Snap } from "./types";

const NOCTURNE_SNAP_ORIGIN = "npm:@nocturne-xyz/snap";

export class SnapStateSdk implements SnapStateApi {
  constructor(
    private version?: string,
    private snapId: string = NOCTURNE_SNAP_ORIGIN,
    private env: SupportedNetwork = "mainnet"
  ) {}

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

  connect = async (): Promise<GetSnapsResponse> => {
    return (await window.ethereum.request({
      method: "wallet_requestSnaps",
      params: {
        [this.snapId]: {
          version: this.version,
        },
      },
    })) as unknown as GetSnapsResponse;
  };

  get = async (): Promise<Snap | undefined> => {
    try {
      const snaps = await this.getSnaps();

      return Object.values(snaps).find(
        (snap) =>
          snap.id === this.snapId &&
          (!this.version || snap.version === this.version)
      );
    } catch (e) {
      console.log("Failed to obtain installed snap", e);
      return undefined;
    }
  };

  clearDb = async (): Promise<void> => {
    if (this.env !== "localhost" && this.env !== "sepolia") {
      throw new Error(
        "Method clearDb is only available in localhost and sepolia"
      );
    }
    const snapId = this.snapId;
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
