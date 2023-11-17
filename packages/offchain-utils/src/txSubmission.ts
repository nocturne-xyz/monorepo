import { Relayer } from "@openzeppelin/defender-relay-client";
import { Address } from "@nocturne-xyz/core";
import { ethers } from "ethers";
import { intFromEnv } from "./configuration";
import * as https from "https";
import { getEthersProviderFromEnv } from "./ethersHelpers";
import { sleep } from "./utils";

const DEFAULT_RPC_TIMEOUT_MS = 3000;

export type TxHash = string;

export interface TxSubmissionArgs {
  to: Address;
  data: string;
}

export interface TxSubmissionOpts {
  value?: number;
  gasLimit?: number;
  speed?: "safeLow" | "average" | "fast" | "fastest";
  isPrivate?: boolean;
  numConfirmations?: number;
}

export interface TxSubmitter {
  address(): Promise<Address>;

  submitTransaction(
    args: TxSubmissionArgs,
    opts?: TxSubmissionOpts
  ): Promise<TxHash>;
}

export function getTxSubmitterFromEnv(): TxSubmitter {
  const relayerApiKey = process.env.OZ_RELAYER_API_KEY;
  const relayerApiSecret = process.env.OZ_RELAYER_API_SECRET;

  const privateKey = process.env.TX_SIGNER_KEY;
  const provider = getEthersProviderFromEnv();
  const timeout = intFromEnv("RPC_TIMEOUT_MS") ?? DEFAULT_RPC_TIMEOUT_MS;

  if (relayerApiKey && relayerApiSecret) {
    const relayer = new Relayer({
      apiKey: relayerApiKey,
      apiSecret: relayerApiSecret,
      httpsAgent: new https.Agent({
        timeout,
        keepAlive: true,
      }),
    });
    return new OzRelayerTxSubmitter(relayer, provider);
  } else if (privateKey) {
    const signer = new ethers.Wallet(privateKey, provider);
    return new EthersTxSubmitter(signer);
  } else {
    throw new Error(
      "must supply either OZ_RELAYER_API_KEY and OZ_RELAYER_API_SECRET or RPC_URL and TX_SIGNER_KEY env vars"
    );
  }
}

export class EthersTxSubmitter implements TxSubmitter {
  signer: ethers.Wallet;

  constructor(signer: ethers.Wallet) {
    this.signer = signer;
  }

  async address(): Promise<Address> {
    return this.signer.getAddress();
  }

  async submitTransaction(
    { to, data }: TxSubmissionArgs,
    opts?: TxSubmissionOpts
  ): Promise<TxHash> {
    const tx = await this.signer.sendTransaction({
      to,
      data,
      value: opts?.value,
      gasLimit: opts?.gasLimit,
      gasPrice: await this.signer.provider.getGasPrice(),
    });

    console.log(`tx dispatched, waiting for confirmation. txhash: ${tx.hash}`);
    await tx.wait(opts?.numConfirmations ?? 1);

    return tx.hash;
  }
}

export class OzRelayerTxSubmitter implements TxSubmitter {
  provider: ethers.providers.JsonRpcProvider;
  relayer: Relayer;

  constructor(relayer: Relayer, provider: ethers.providers.JsonRpcProvider) {
    this.relayer = relayer;
    this.provider = provider;
  }

  async address(): Promise<Address> {
    return (await this.relayer.getRelayer()).address;
  }

  async submitTransaction(
    { to, data }: TxSubmissionArgs,
    opts?: TxSubmissionOpts
  ): Promise<TxHash> {
    let relayerTx = await this.relayer.sendTransaction({
      to,
      data,
      value: opts?.value ?? 0,
      speed: opts?.speed ?? "fast",
      gasLimit:
        opts?.gasLimit ??
        Number(
          await this.provider.estimateGas({
            to,
            data,
            from: await this.address(),
          })
        ),
    });

    console.log(
      `tx dispatched, waiting for confirmation. relay id: ${relayerTx.transactionId}`
    );

    let txHash = relayerTx.hash;
    let maybeFinalTxHash: TxHash | undefined;
    while (true) {
      txHash = (await this.relayer.query(relayerTx.transactionId)).hash;
      console.log("fetching transaction object by txhash");
      const tx: ethers.providers.TransactionResponse | null =
        await this.provider.getTransaction(txHash);

      if (!tx) {
        console.log("tx not found, polling again in 5s");
        await sleep(5_000);
        continue;
      }

      const numConfirmations = opts?.numConfirmations ?? 1;
      console.log(`waiting for ${numConfirmations} confirmations`);
      maybeFinalTxHash = await waitForConfirmationsWithTimeout(
        tx,
        30,
        numConfirmations
      );

      // if tx hash got confirmation, break and return
      if (maybeFinalTxHash) {
        break;
      }

      // if tx hash not defined then it was not confirmed, refetch from OZ relay
      if (!maybeFinalTxHash) {
        console.log("tx hash not defined, refetching from OZ relay");
        relayerTx = await this.relayer.query(relayerTx.transactionId);
        continue;
      }
    }

    console.log(`tx confirmed. txhash: ${relayerTx.hash}`);
    return maybeFinalTxHash;
  }
}

export function waitForConfirmationsWithTimeout(
  tx: ethers.providers.TransactionResponse,
  timeoutSeconds: number = 30,
  confirmations: number = 1
): Promise<TxHash | undefined> {
  const waitForConfirmation = async () => {
    try {
      await tx.wait(confirmations);

      console.log(`tx confirmed. hash ${tx.hash}`);
      return tx.hash;
    } catch (error) {
      console.error("Error in transaction confirmation:", error);
      return undefined;
    }
  };

  // Create a timeout promise
  const timeout = new Promise<undefined>((resolve) =>
    setTimeout(() => {
      console.log("tx confirmations timeout ended");
      resolve(undefined);
    }, timeoutSeconds * 1000)
  );

  // Race the two promises
  return Promise.race([waitForConfirmation(), timeout]);
}
