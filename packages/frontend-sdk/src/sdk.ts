import {
  OperationRequest,
  packToSolidityProof,
  ProvenOperation,
  ProvenJoinSplitTx,
  PreProofOperation,
  NocturneAddress,
  AssetWithBalance,
  encodeAsset,
  AssetType,
  Address,
} from "@nocturne-xyz/sdk";
import { DEFAULT_SNAP_ORIGIN } from "./common";
import { LocalJoinSplitProver } from "@nocturne-xyz/local-prover";
import * as JSON from "bigint-json-serialization";
import { Wallet, Wallet__factory } from "@nocturne-xyz/contracts";
import { ContractTransaction, ethers } from "ethers";

const WASM_PATH = "/joinsplit.wasm";
const ZKEY_PATH = "/joinsplit.zkey";
const VKEY_PATH = "/joinSplitVkey.json";

export class NocturneFrontendSDK {
  localProver: LocalJoinSplitProver;
  walletContract: Wallet;

  private constructor(
    walletContract: Wallet,
    wasmPath: string,
    zkeyPath: string,
    vkey: any
  ) {
    this.localProver = new LocalJoinSplitProver(wasmPath, zkeyPath, vkey);
    this.walletContract = walletContract;
  }

  /**
   * Instantiate new `NocturneFrontendSDK` instance.
   *
   * @param walletContractAddress Wallet contract address
   * @param wasPath Joinsplit wasm path
   * @param zkeyPath Joinsplit zkey path
   * @param vkey Vkey object
   */
  static async instantiate(
    walletContractAddress: string,
    wasmPath: string,
    zkeyPath: string,
    vkey: any
  ): Promise<NocturneFrontendSDK> {
    const walletContract = await NocturneFrontendSDK.connectWalletContract(
      walletContractAddress
    );
    return new NocturneFrontendSDK(walletContract, wasmPath, zkeyPath, vkey);
  }

  private static async connectWalletContract(
    walletContractAddress: string
  ): Promise<Wallet> {
    const provider = new ethers.providers.Web3Provider(window.ethereum as any);
    await provider.send("eth_requestAccounts", []);
    const signer = provider.getSigner();
    return Wallet__factory.connect(walletContractAddress, signer);
  }

  /**
   * Call `walletContract.depositFunds` given the provided `assetType`,
   * `assetAddress`, `value`, and `assetId`.
   *
   * @param assetType Asset type
   * @param assetAddress Asset address
   * @param value Asset amount
   * @param assetId Asset id
   */
  async depositFunds(
    assetType: AssetType,
    assetAddress: Address,
    assetId: bigint,
    value: bigint
  ): Promise<ContractTransaction> {
    const spender = await this.walletContract.signer.getAddress();
    const depositAddr = await this.getRandomizedAddr();
    const { encodedAssetAddr, encodedAssetId } = encodeAsset({
      assetType,
      assetAddr: assetAddress,
      id: assetId,
    });
    return this.walletContract.depositFunds({
      spender,
      encodedAssetAddr,
      encodedAssetId,
      value,
      depositAddr,
    });
  }

  /**
   * Generate `ProvenOperation` given an `operationRequest`.
   *
   * @param operationRequest Operation request
   */
  async generateProvenOperation(
    operationRequest: OperationRequest
  ): Promise<ProvenOperation> {
    const joinSplitInputs = await this.getJoinSplitInputsFromSnap(
      operationRequest
    );

    const provenJoinSplitPromises: Promise<ProvenJoinSplitTx>[] =
      joinSplitInputs.joinSplitTxs.map(
        async ({ proofInputs, ...joinSplitTx }) => {
          const { proof } = await this.localProver.proveJoinSplit(proofInputs);

          return {
            proof: packToSolidityProof(proof),
            ...joinSplitTx,
          };
        }
      );

    const {
      joinSplitRequests,
      refundAssets,
      actions,
      verificationGasLimit = 1_000_000n,
      executionGasLimit = 1_000_000n,
      gasPrice = 0n,
      maxNumRefunds = BigInt(refundAssets.length + joinSplitRequests.length),
    } = operationRequest;

    const encodedRefundAssets = refundAssets.map(encodeAsset);

    const joinSplitTxs = await Promise.all(provenJoinSplitPromises);
    const refundAddr = await this.getRandomizedAddr();
    return {
      joinSplitTxs,
      refundAddr,
      encodedRefundAssets,
      actions,
      verificationGasLimit,
      executionGasLimit,
      gasPrice,
      maxNumRefunds,
    };
  }

  /**
   * Return a list of snap's assets (address & id) along with its given balance.
   */
  async getAllBalances(): Promise<AssetWithBalance[]> {
    const json = (await window.ethereum.request({
      method: "wallet_invokeSnap",
      params: [
        DEFAULT_SNAP_ORIGIN,
        {
          method: "nocturne_getAllBalances",
        },
      ],
    })) as string;

    return JSON.parse(json) as AssetWithBalance[];
  }

  /**
   * Invoke snap `syncNotes` method.
   */
  async syncNotes(): Promise<void> {
    await window.ethereum.request({
      method: "wallet_invokeSnap",
      params: [
        DEFAULT_SNAP_ORIGIN,
        {
          method: "nocturne_syncNotes",
        },
      ],
    });
  }

  /**
   * Invoke snap `syncLeaves` method.
   */
  async syncLeaves(): Promise<void> {
    await window.ethereum.request({
      method: "wallet_invokeSnap",
      params: [
        DEFAULT_SNAP_ORIGIN,
        {
          method: "nocturne_syncLeaves",
        },
      ],
    });
  }

  /**
   * Retrieve a `PreProofOperation` from the snap given an `OperationRequest`.
   * This includes all joinsplit tx inputs.
   *
   * @param operationRequest Operation request
   */
  protected async getJoinSplitInputsFromSnap(
    operationRequest: OperationRequest
  ): Promise<PreProofOperation> {
    const json = (await window.ethereum.request({
      method: "wallet_invokeSnap",
      params: [
        DEFAULT_SNAP_ORIGIN,
        {
          method: "nocturne_getJoinSplitInputs",
          params: { operationRequest: JSON.stringify(operationRequest) },
        },
      ],
    })) as string;

    return JSON.parse(json) as PreProofOperation;
  }

  /**
   * Retrieve a freshly randomized address from the snap.
   */
  protected async getRandomizedAddr(): Promise<NocturneAddress> {
    const json = (await window.ethereum.request({
      method: "wallet_invokeSnap",
      params: [
        DEFAULT_SNAP_ORIGIN,
        {
          method: "nocturne_getRandomizedAddr",
        },
      ],
    })) as string;

    return JSON.parse(json) as NocturneAddress;
  }
}

/**
 * Load a `NocturneFrontendSDK` instance, provided paths to a wallet contract
 * address, local prover's wasm, zkey, and vkey. Circuit file paths default to
 * caller's current directory (joinsplit.wasm, joinsplit.zkey, joinSplitVkey.
 * json).
 *
 * @param wasmPath Wasm path
 * @param zkeyPath Zkey path
 * @param vkeyPath Vkey path
 */
export async function loadNocturneFrontendSDK(
  walletContractAddress: string,
  wasmPath: string = WASM_PATH,
  zkeyPath: string = ZKEY_PATH,
  vkeyPath: string = VKEY_PATH
): Promise<NocturneFrontendSDK> {
  const vkey = JSON.parse(await (await fetch(vkeyPath)).text());
  return await NocturneFrontendSDK.instantiate(
    walletContractAddress,
    wasmPath,
    zkeyPath,
    vkey
  );
}
