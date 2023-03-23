import { DepositManager, Wallet } from "@nocturne-xyz/contracts";
import {
  DepositRequest,
  NocturneWalletSDK,
  OperationRequest,
  sleep,
  JoinSplitProver,
  proveOperation,
} from "@nocturne-xyz/sdk";
import { Mutex } from "async-mutex";
import { randomInt } from "crypto";
import * as JSON from "bigint-json-serialization";

export class TestActor {
  wallet: Wallet;
  depositManager: DepositManager;
  sdk: NocturneWalletSDK;
  prover: JoinSplitProver;
  bundlerEndpoint: string;

  depositRequests: DepositRequest[];
  opRequests: OperationRequest[];

  constructor(
    wallet: Wallet,
    depositManager: DepositManager,
    sdk: NocturneWalletSDK,
    prover: JoinSplitProver,
    bundlerEndpoint: string,
    depositRequests: DepositRequest[],
    opRequests: OperationRequest[],
  ) {
    this.wallet = wallet;
    this.depositManager = depositManager;
    this.sdk = sdk;
    this.prover = prover;
    this.bundlerEndpoint = bundlerEndpoint;

    this.depositRequests = depositRequests;
    this.opRequests = opRequests;
  }

  async run(): Promise<void> {
    while (true) {
      await this.sdk.sync();

      if (flipCoin()) {
        await this.deposit();
      } else {
        await this.operation();
      }
    }
  }

  /// helpers

  private async operation() {
    // choose a random opRequest
    const opRequest = randomElem(this.opRequests);

    // prepare, sign, and prove
    const preSign = await this.sdk.prepareOperation(opRequest);
    const signed = this.sdk.signOperation(preSign);
    const proven = proveOperation(this.prover, signed);

    // submit
    const res = await fetch(`${this.bundlerEndpoint}/relay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(proven),
    });

    const resJSON = await res.json();
    if (!res.ok) {
      throw new Error(
        `Failed to submit proven operation to bundler: ${JSON.stringify(
          resJSON
        )}`
      );
    }
  }

  private async deposit() {
    // choose a random deposit request and set its nonce
    const depositRequest = randomElem(this.depositRequests);

    // set its nonce
    const nonce = await this.depositManager._nonces(depositRequest.spender);
    depositRequest.nonce = nonce.toBigInt();

    // submit
    console.log(
      `instantiating deposit request ${JSON.stringify(depositRequest)}`
    );
    const instantiateDepositTx = await this.depositManager.instantiateDeposit(
      depositRequest
    );
    await instantiateDepositTx.wait(1);

    // TODO request from deposit screener instead
    console.log("waiting for deposit to be processed");
    await sleep(10_000);
  }
}

function randomElem<T>(arr: T[]): T {
  return arr[randomInt(arr.length)];
}

function flipCoin(): boolean {
  return Math.random() < 0.5;
}
