import {
  RequestSpendKeyEoaMethod,
  RpcRequestMethod,
  SetSpendKeyMethod,
  stringifyObjectValues,
} from "@nocturne-xyz/client";
import * as JSON from "bigint-json-serialization";
import { SnapStateApi } from "../api";
import { generateNocturneSpendKeyFromEoaSig } from "../eoaSigKeygen";
import { SupportedProvider } from "../types";
import { GetSnapsResponse, Snap } from "./types";
import { getSigner } from "./utils";

export * from "./utils";

const NOCTURNE_SNAP_ORIGIN = "npm:@nocturne-xyz/snap";

export class SnapStateSdk implements SnapStateApi {
  constructor(
    // this is lazy so it plays nice with server components
    readonly getProvider: () => SupportedProvider,
    readonly version?: string,
    readonly snapId: string = NOCTURNE_SNAP_ORIGIN,
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
    const res = (await window.ethereum.request({
      method: "wallet_requestSnaps",
      params: {
        [this.snapId]: {
          version: this.version,
        },
      },
    })) as unknown as GetSnapsResponse;

    await this.generateAndStoreSpendKeyFromEoaSigIfNotAlreadySet();

    return res;
  }

  async get(): Promise<Snap | undefined> {
    try {
      const snaps = await this.getSnaps();

      const snap = Object.values(snaps).find(
        (snap) =>
          snap.id === this.snapId &&
          (!this.version || snap.version === this.version),
      );
      await this.generateAndStoreSpendKeyFromEoaSigIfNotAlreadySet();
      return snap;
    } catch (e) {
      console.log("Failed to obtain installed snap", e);
      return undefined;
    }
  }

  async invoke<RpcMethod extends RpcRequestMethod>(
    request: Omit<RpcMethod, "return">,
  ): Promise<RpcMethod["return"]> {
    console.log("[fe-sdk] invoking snap method:", request.method);
    const stringifiedParams = request.params
      ? stringifyObjectValues(request.params)
      : undefined;
    const jsonRpcRequest = {
      method: "wallet_invokeSnap",
      params: {
        snapId: this.snapId,
        request: {
          method: request.method,
          params: stringifiedParams,
        },
      },
    };
    const response = await window.ethereum.request<{ res: string | null }>(
      jsonRpcRequest,
    );
    if (!response) {
      throw new Error("No response from MetaMask");
    }

    const { res } = response;
    return res ? JSON.parse(res) : undefined;
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

  /**
   * Generate spend key based on Ethereum private key signature, then pass to snap
   * to store/manage.
   * Will throw an error if the snap already has a key stored.
   * This function should only be used an alternative to the default key generation using the
   * snap's internal seed phrase when portability is required.
   * @dev WARNING: The spending key will momentarily exist in memory.
   */
  private async generateAndStoreSpendKeyFromEoaSigIfNotAlreadySet(): Promise<void> {
    // Return early if spend key already set
    const spendKeyEoa = await this.invoke<RequestSpendKeyEoaMethod>({
      method: "nocturne_requestSpendKeyEoa",
      params: undefined,
    });
    if (spendKeyEoa) {
      return;
    }

    // Generate spend key and attempt to set in snap
    const signer = await getSigner(this.getProvider());
    const signerAddress = await signer.getAddress();
    const spendKey = await generateNocturneSpendKeyFromEoaSig(signer);

    const maybeErrorString = await this.invoke<SetSpendKeyMethod>({
      method: "nocturne_setSpendKey",
      params: {
        spendKey,
        eoaAddress: signerAddress,
      },
    });

    // Notify consumer if spend key was not actually set (in case of some race condition where it was set between the first spendKeyIsSet check and the setSpendKey call)
    if (maybeErrorString) {
      throw new Error(maybeErrorString);
    }
  }
}
