import { SnapStateApi } from "../api";
import { GetSnapsResponse, Snap } from "./types";

const NOCTURNE_SNAP_ORIGIN = "npm:@nocturne-xyz/snap";

export class SnapStateSdk implements SnapStateApi {
  constructor(
    readonly version?: string,
    readonly snapId: string = NOCTURNE_SNAP_ORIGIN
  ) {}

  async isFlask(): Promise<boolean> {
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
  }

  async connect(): Promise<GetSnapsResponse> {
    return (await window.ethereum.request({
      method: "wallet_requestSnaps",
      params: {
        [this.snapId]: {
          version: this.version,
        },
      },
    })) as unknown as GetSnapsResponse;
  }

  async get(): Promise<Snap | undefined> {
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
  }

  /**
   * Get the installed snaps in MetaMask.
   * https://docs.metamask.io/snaps/reference/rpc-api/#wallet_getsnaps
   *
   * @returns The snaps installed in MetaMask.
   */
  protected async getSnaps(): Promise<GetSnapsResponse> {
    return (await window.ethereum.request({
      method: "wallet_getSnaps",
    })) as unknown as GetSnapsResponse;
  }
}
