import { Relayer } from "@openzeppelin/defender-relay-client";
import { Address } from "@nocturne-xyz/core";
import { ethers } from "ethers";
import { intFromEnv } from "./configuration";
import * as https from "https";
import { getEthersProviderFromEnv } from "./ethersHelpers";
import { sleep } from "./utils";
import { Logger } from "winston";

const DEFAULT_RPC_TIMEOUT_MS = 3000;

export type TxHash = string;

export interface TxSubmissionArgs {
  to: Address;
  data: string;
}

export type TxSpeed = "safeLow" | "average" | "fast" | "fastest";

export interface TxSubmissionOpts {
  value?: number;
  gasLimit?: number;
  speed?: TxSpeed;
  isPrivate?: boolean;
  numConfirmations?: number;
  logger?: Logger;
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
  const relayerSpeed = process.env.OZ_RELAYER_SPEED as TxSpeed | undefined;

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

    return new OzRelayerTxSubmitter(relayer, provider, relayerSpeed);
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

    opts?.logger &&
      opts.logger.debug(
        `tx dispatched, waiting for confirmation. txhash: ${tx.hash}`
      );
    await tx.wait(opts?.numConfirmations ?? 1);

    return tx.hash;
  }
}

export class OzRelayerTxSubmitter implements TxSubmitter {
  provider: ethers.providers.JsonRpcProvider;
  relayer: Relayer;
  speed: TxSpeed;

  constructor(
    relayer: Relayer,
    provider: ethers.providers.JsonRpcProvider,
    speed: TxSpeed = "fast"
  ) {
    this.relayer = relayer;
    this.provider = provider;
    this.speed = speed;
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
      speed: opts?.speed ?? this.speed,
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

    opts?.logger &&
      opts.logger.debug(
        `tx dispatched, waiting for confirmation. relay id: ${relayerTx.transactionId}`
      );

    let txHash = relayerTx.hash;
    let maybeFinalTxHash: TxHash | undefined;
    while (true) {
      txHash = (await this.relayer.query(relayerTx.transactionId)).hash;
      opts?.logger &&
        opts.logger.debug("fetching transaction object by txhash");
      const tx: ethers.providers.TransactionResponse | null =
        await this.provider.getTransaction(txHash);

      if (!tx) {
        opts?.logger && opts.logger.debug("tx not found, polling again in 5s");
        await sleep(5_000);
        continue;
      }

      const numConfirmations = opts?.numConfirmations ?? 1;
      opts?.logger &&
        opts.logger.debug(`waiting for ${numConfirmations} confirmations`);
      maybeFinalTxHash = await waitForConfirmationsWithTimeout(tx, {
        timeoutSeconds: 30,
        confirmations: numConfirmations,
        logger: opts?.logger,
      });

      // if tx hash got confirmation, break and return
      if (maybeFinalTxHash) {
        break;
      }

      // if tx hash not defined then it was not confirmed, refetch from OZ relay
      if (!maybeFinalTxHash) {
        opts?.logger &&
          opts.logger.debug("tx hash not defined, refetching from OZ relay");
        relayerTx = await this.relayer.query(relayerTx.transactionId);
        continue;
      }
    }

    opts?.logger &&
      opts.logger.debug(`tx confirmed. txhash: ${relayerTx.hash}`);
    return maybeFinalTxHash;
  }
}

interface WaitForConfirmationOpts {
  confirmations?: number;
  timeoutSeconds?: number;
  logger?: Logger;
}

export function waitForConfirmationsWithTimeout(
  tx: ethers.providers.TransactionResponse,
  opts?: WaitForConfirmationOpts
): Promise<TxHash | undefined> {
  const waitForConfirmation = async () => {
    try {
      await tx.wait(opts?.confirmations ?? 1);

      opts?.logger && opts.logger.debug(`tx confirmed. hash ${tx.hash}`);
      return tx.hash;
    } catch (error) {
      console.error("Error in transaction confirmation:", error);
      return undefined;
    }
  };

  // Create a timeout promise
  const timeout = new Promise<undefined>((resolve) =>
    setTimeout(() => {
      opts?.logger && opts.logger.debug("tx confirmations timeout ended");
      resolve(undefined);
    }, (opts?.timeoutSeconds ?? 30) * 1000)
  );

  // Race the two promises
  return Promise.race([waitForConfirmation(), timeout]);
}
