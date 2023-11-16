import { Relayer } from "@openzeppelin/defender-relay-client";
import { Address } from "@nocturne-xyz/core";
import { sleep } from "./utils";
import { ethers } from "ethers";

export type TxHash = string;

export interface TxSubmissionOpts {
  value?: number;
  gasLimit?: number;
  speed?: "safeLow" | "average" | "fast" | "fastest";
  isPrivate?: boolean;
  numConfirmations?: number;
}

export interface TxSubmitter {
  sendTransaction(
    to: Address,
    data: string,
    opts: TxSubmissionOpts
  ): Promise<TxHash>;
}

export class EthersTxSubmitter implements TxSubmitter {
  signer: ethers.Wallet;

  constructor(signer: ethers.Wallet) {
    this.signer = signer;
  }

  async sendTransaction(
    to: Address,
    data: string,
    opts: TxSubmissionOpts
  ): Promise<TxHash> {
    const tx = await this.signer.sendTransaction({
      to,
      data,
      value: opts.value,
      gasLimit: opts.gasLimit,
      gasPrice: await this.signer.provider.getGasPrice(),
    });

    await tx.wait(opts.numConfirmations);

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

  async sendTransaction(
    to: string,
    data: string,
    opts: TxSubmissionOpts
  ): Promise<TxHash> {
    let relayerTx = await this.relayer.sendTransaction({
      to,
      data,
      value: opts.value,
      speed: opts.speed ?? "fast",
      gasLimit:
        opts.gasLimit ?? Number(await this.provider.estimateGas({ to, data })),
    });

    while (relayerTx.status != "confirmed") {
      await sleep(5_000);
      relayerTx = await this.relayer.query(relayerTx.transactionId);
    }

    return relayerTx.hash;
  }
}
