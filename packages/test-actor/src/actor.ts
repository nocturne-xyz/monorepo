import { DepositManager, Wallet } from "@nocturne-xyz/contracts";
import { NocturneFrontendSDK } from "@nocturne-xyz/frontend-sdk";
import { DepositRequest, NocturneWalletSDK, OperationRequest, sleep } from "@nocturne-xyz/sdk";
import { Mutex } from "async-mutex";
import { randomInt } from "crypto";
import * as JSON from "bigint-json-serialization";

export class TestActor {
	wallet: Wallet;
	depositManager: DepositManager;
	sdk: NocturneWalletSDK;
  frontendSDK: NocturneFrontendSDK;

	depositRequests: DepositRequest[];
	opRequests: OperationRequest[];

	mutex: Mutex;

	constructor(
    wallet: Wallet,
    depositManager: DepositManager,
    sdk: NocturneWalletSDK,
    frontendSDK: NocturneFrontendSDK,
    depositRequests: DepositRequest[],
    opRequests: OperationRequest[],
  ) {
    this.wallet = wallet;
    this.depositManager = depositManager;
    this.sdk = sdk;
    this.frontendSDK = frontendSDK;

		this.depositRequests = depositRequests;
	  this.opRequests = opRequests;

    this.mutex = new Mutex();
  }

	async getOpRequests(): Promise<OperationRequest[]> {
    let opRequests: OperationRequest[] = [];
    await this.mutex.runExclusive(() => {
      opRequests = structuredClone(this.opRequests);
    });

    return opRequests;
  }

  async updateOpRequests(update: (currentOpRequests: OperationRequest[]) => Promise<OperationRequest[]>): Promise<void> {
    this.mutex.runExclusive(async () => {
      this.opRequests = await update(this.opRequests);
    })
  }

	async getDepositRequests(): Promise<DepositRequest[]> {
    let depositRequests: DepositRequest[] = [];
    await this.mutex.runExclusive(() => {
      depositRequests = structuredClone(this.depositRequests);
    });

    return depositRequests;
  }

  async updateDepositRequests(update: (currentDepositRequests: DepositRequest[]) => Promise<DepositRequest[]>): Promise<void> {
    this.mutex.runExclusive(async () => {
      this.depositRequests = await update(this.depositRequests);
    })
  }

	start(): () => Promise<void> {
		let done = false;

    const run = async () => {
      while (!done) {
        await this.sdk.sync();

        if (flipCoin()) {
          await this.deposit();
        } else {
          await this.sendOpRequest();
        }
      }
    };

    let prom = run();

    return async () => {
      done = true;
      await prom;
    }
	}

  /// helpers

	private async sendOpRequest() {
    await this.mutex.runExclusive(async () => {
      // choose a random opRequest
      const opRequest = randomElem(this.opRequests);

      // prepare, sign, prove, and submit
      const preSign = await this.sdk.prepareOperation(opRequest);
      const signed = this.sdk.signOperation(preSign);
      const proven = await this.frontendSDK.proveOperation(signed);
      await this.frontendSDK.submitProvenOperation(proven);
    });
	}

	private async deposit() {
    await this.mutex.runExclusive(async () => {
      // choose a random deposit request and set its nonce
      const depositRequest = randomElem(this.depositRequests);

      // submit it
      await this.submitDepositRequest(depositRequest)
    });
	}

  // TODO: use FE SDK instead once deposit screener is done
  private async submitDepositRequest(depositRequest: DepositRequest) {

    console.log(
      `instantiating deposit request ${JSON.stringify(depositRequest)}`
    );
    const instantiateDepositTx = await this.depositManager
      .instantiateDeposit(depositRequest);
    await instantiateDepositTx.wait(1);

    // TODO request from deposit screener instead
    console.log("waiting for deposit to be processed")
    await sleep(10_000);
  }
}

function randomElem<T>(arr: T[]): T {
  return arr[randomInt(arr.length)];
}

function flipCoin(): boolean {
  return Math.random() < 0.5;
}
