import {
  DepositManager,
  SimpleERC1155Token__factory,
  SimpleERC20Token__factory,
  SimpleERC721Token__factory,
  Wallet,
} from "@nocturne-xyz/contracts";
import {
  DepositRequest,
  NocturneWalletSDK,
  OperationRequest,
  sleep,
  JoinSplitProver,
  proveOperation,
  AssetTrait,
  AssetType,
} from "@nocturne-xyz/sdk";
import { randomInt } from "crypto";
import * as JSON from "bigint-json-serialization";

export class TestActor {
  wallet: Wallet;
  depositManager: DepositManager;
  sdk: NocturneWalletSDK;
  prover: JoinSplitProver;
  bundlerEndpoint: string;

  depositRequests: Omit<DepositRequest, "nonce">[];
  opRequests: OperationRequest[];

  constructor(
    wallet: Wallet,
    depositManager: DepositManager,
    sdk: NocturneWalletSDK,
    prover: JoinSplitProver,
    bundlerEndpoint: string,
    depositRequests: DepositRequest[],
    opRequests: OperationRequest[]
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
    const depositRequestWithoutNonce = randomElem(this.depositRequests);

    // set its nonce
    const nonce = await this.depositManager._nonces(
      depositRequestWithoutNonce.spender
    );
    const depositRequest: DepositRequest = {
      ...depositRequestWithoutNonce,
      nonce: nonce.toBigInt(),
    };

    // approve asset to depositManager
    const asset = AssetTrait.decode(depositRequest.encodedAsset);
    switch (asset.assetType) {
      case AssetType.ERC20: {
        const contract = SimpleERC20Token__factory.connect(
          asset.assetAddr,
          this.depositManager.signer
        );
        const tx = await contract.approve(
          this.depositManager.address,
          depositRequest.value
        );
        await tx.wait(1);
        break;
      }
      case AssetType.ERC721: {
        const contract = SimpleERC721Token__factory.connect(
          asset.assetAddr,
          this.depositManager.signer
        );
        const tx = await contract.approve(
          this.depositManager.address,
          asset.id
        );
        await tx.wait(1);
        break;
      }
      case AssetType.ERC1155: {
        const contract = SimpleERC1155Token__factory.connect(
          asset.assetAddr,
          this.depositManager.signer
        );
        // NOTE: AFAICT ERC1155 only has "approveAll"
        const tx = await contract.setApprovalForAll(
          this.depositManager.address,
          true
        );
        await tx.wait(1);
        break;
      }
    }

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
