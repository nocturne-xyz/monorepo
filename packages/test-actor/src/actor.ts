import {
  DepositManager,
  SimpleERC20Token__factory,
  Teller,
} from "@nocturne-xyz/contracts";
import {
  NocturneWalletSDK,
  OperationRequest,
  sleep,
  JoinSplitProver,
  proveOperation,
} from "@nocturne-xyz/sdk";
import * as JSON from "bigint-json-serialization";
import { Erc20Config } from "@nocturne-xyz/config";
import { ethers } from "ethers";

const FIVE_MINUTES_AS_MILLIS = 5 * 60 * 1000;

export class TestActor {
  txSigner: ethers.Wallet;
  teller: Teller;
  depositManager: DepositManager;
  sdk: NocturneWalletSDK;
  prover: JoinSplitProver;
  bundlerEndpoint: string;

  erc20s: Map<string, Erc20Config>;
  opRequests: OperationRequest[];

  constructor(
    txSigner: ethers.Wallet,
    teller: Teller,
    depositManager: DepositManager,
    sdk: NocturneWalletSDK,
    prover: JoinSplitProver,
    bundlerEndpoint: string,
    erc20s: Map<string, Erc20Config>,
    opRequests: OperationRequest[]
  ) {
    this.txSigner = txSigner;
    this.teller = teller;
    this.depositManager = depositManager;
    this.sdk = sdk;
    this.prover = prover;
    this.bundlerEndpoint = bundlerEndpoint;

    this.erc20s = erc20s;
    this.opRequests = opRequests;
  }

  async run(): Promise<void> {
    while (true) {
      await this.sdk.sync();

      if (flipCoin()) {
        console.log("switched on deposit");
        await this.deposit();
      } else {
        console.log("switched on operation");
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
        `failed to submit proven operation to bundler: ${JSON.stringify(
          resJSON
        )}`
      );
    }
  }

  private async deposit() {
    // choose a random deposit request and set its nonce
    console.log(`erc20 entries: ${Array.from(this.erc20s.entries())}`);
    const [erc20Name, erc20Config] = randomElem(
      Array.from(this.erc20s.entries())
    );
    const randomValue = randomInt(1_000);

    console.log(`reserving tokens. token: ${erc20Name}, value: ${randomValue}`);
    const erc20Token = SimpleERC20Token__factory.connect(
      erc20Config.address,
      this.txSigner
    );
    const reserveTx = await erc20Token.reserveTokens(
      this.txSigner.address,
      randomValue
    );
    await reserveTx.wait(1);

    console.log(`approving tokens. token: ${erc20Name}, value: ${randomValue}`);
    const approveTx = await erc20Token.approve(
      this.depositManager.address,
      randomValue
    );
    await approveTx.wait(1);

    // submit
    console.log(
      `instantiating erc20 deposit request for ${erc20Name} with value ${randomValue}`
    );
    const instantiateDepositTx =
      await this.depositManager.instantiateErc20MultiDeposit(
        erc20Token.address,
        [randomValue],
        this.sdk.signer.generateRandomStealthAddress()
      );
    await instantiateDepositTx.wait(1);

    // TODO request from deposit screener instead
    console.log("waiting for deposit to be processed");
    await sleep(FIVE_MINUTES_AS_MILLIS);
  }
}

function randomInt(max: number) {
  return Math.floor(Math.random() * max);
}

function randomElem<T>(arr: T[]): T {
  return arr[randomInt(arr.length)];
}

function flipCoin(): boolean {
  return true; // TODO: make 50% after deposits work
}
