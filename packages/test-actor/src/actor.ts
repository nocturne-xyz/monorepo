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
  parseEventsFromContractReceipt,
  Asset,
  randomBigInt,
  OperationRequestBuilder,
  computeOperationDigest,
  StealthAddressTrait,
} from "@nocturne-xyz/sdk";
import * as JSON from "bigint-json-serialization";
import { Erc20Config } from "@nocturne-xyz/config";
import { ethers } from "ethers";
import { DepositInstantiatedEvent } from "@nocturne-xyz/contracts/dist/src/DepositManager";

const ONE_MINUTE_AS_MILLIS = 60 * 1000;
const ONE_DAY_SECONDS = 60n * 60n * 24n;
const ONE_ETH_IN_WEI = 10n ** 18n;

export class TestActorOpts {
  intervalSeconds?: number;
  onlyDeposits?: boolean;
  onlyOperations?: boolean;
}

export class TestActor {
  txSigner: ethers.Wallet;
  teller: Teller;
  depositManager: DepositManager;
  sdk: NocturneWalletSDK;
  prover: JoinSplitProver;
  bundlerEndpoint: string;
  erc20s: Map<string, Erc20Config>;

  constructor(
    txSigner: ethers.Wallet,
    teller: Teller,
    depositManager: DepositManager,
    sdk: NocturneWalletSDK,
    prover: JoinSplitProver,
    bundlerEndpoint: string,
    erc20s: Map<string, Erc20Config>
  ) {
    this.txSigner = txSigner;
    this.teller = teller;
    this.depositManager = depositManager;
    this.sdk = sdk;
    this.prover = prover;
    this.bundlerEndpoint = bundlerEndpoint;

    this.erc20s = erc20s;
  }

  async run(opts?: TestActorOpts): Promise<void> {
    const intervalMs = opts?.intervalSeconds
      ? opts.intervalSeconds * 1000
      : ONE_MINUTE_AS_MILLIS;

    while (true) {
      await this.sdk.sync();
      const balances = await this.sdk.getAllAssetBalances();
      console.log("balances: ", balances);

      let actionTaken = false;
      if (opts?.onlyDeposits) {
        console.log("depositing");
        actionTaken = await this.deposit();
      } else if (opts?.onlyOperations) {
        console.log("performing operation");
        actionTaken = await this.randomOperation();
      } else {
        if (flipCoin()) {
          console.log("switched on deposit");
          actionTaken = await this.deposit();
        } else {
          console.log("switched on operation");
          actionTaken = await this.randomOperation();
        }
      }

      if (actionTaken) {
        console.log(`sleeping for ${intervalMs / 1000} seconds`);
        await sleep(intervalMs);
      }
    }
  }

  private async getRandomErc20AndValue(): Promise<[Asset, bigint] | undefined> {
    const assetsWithBalance = await this.sdk.getAllAssetBalances();
    if (assetsWithBalance.length === 0) {
      console.log("no asset balances");
      return undefined;
    }

    // Try for random asset
    const randomAsset = randomElem(assetsWithBalance);

    // If random chosen doesn't have any funds, find the first one with funds
    if (randomAsset.balance > 0) {
      const value = randomBigIntBounded(randomAsset.balance / 25n);
      return [randomAsset.asset, value];
    } else {
      for (const asset of assetsWithBalance) {
        if (asset.balance > 0) {
          const value = randomBigIntBounded(randomAsset.balance / 25n);
          return [asset.asset, value];
        }
      }
    }

    return undefined;
  }

  private async deposit(): Promise<boolean> {
    // choose a random deposit request and set its nonce
    console.log(
      `erc20 entries: ${JSON.stringify(Array.from(this.erc20s.entries()))}`
    );
    const [erc20Name, erc20Config] = randomElem(
      Array.from(this.erc20s.entries())
    );
    const randomValue = randomBigintInRange(
      ONE_ETH_IN_WEI,
      10n * ONE_ETH_IN_WEI
    );

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
        StealthAddressTrait.compress(
          this.sdk.signer.generateRandomStealthAddress()
        )
      );
    const receipt = await instantiateDepositTx.wait(1);

    const matchingEvents = parseEventsFromContractReceipt(
      receipt,
      this.depositManager.interface.getEvent("DepositInstantiated")
    ) as DepositInstantiatedEvent[];
    console.log(`instantiate deposit tx: ${JSON.stringify(matchingEvents)}`);

    return true;
  }

  private async randomOperation(): Promise<boolean> {
    // choose a random joinsplit asset for oprequest
    const maybeErc20AndValue = await this.getRandomErc20AndValue();
    if (!maybeErc20AndValue) {
      return false;
    }
    const [asset, value] = maybeErc20AndValue;

    console.log(
      `Attempting operation with asset ${asset.assetAddr} and value ${value}`
    );

    let opRequest: OperationRequest;
    if (true) {
      opRequest = await this.erc20TransferOpRequest(asset, value);
    } else {
      // TODO: add swapper call case and replace if(true) with flipcoin
    }

    // prepare, sign, and prove
    const preSign = await this.sdk.prepareOperation(opRequest);
    const signed = this.sdk.signOperation(preSign);
    await this.sdk.applyOptimisticRecordsForOp(signed);

    console.log(`proving operation: ${computeOperationDigest(signed)}`);
    const proven = await proveOperation(this.prover, signed);
    console.log(JSON.stringify(proven));

    // submit
    const res = await fetch(`${this.bundlerEndpoint}/relay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ operation: proven }),
    });

    const resJSON = await res.json();
    if (!res.ok) {
      throw new Error(
        `failed to submit proven operation to bundler: ${JSON.stringify(
          resJSON
        )}`
      );
    }

    return true;
  }

  private async erc20TransferOpRequest(
    asset: Asset,
    value: bigint
  ): Promise<OperationRequest> {
    const simpleErc20 = SimpleERC20Token__factory.connect(
      asset.assetAddr,
      this.txSigner
    );
    const transferData =
      SimpleERC20Token__factory.createInterface().encodeFunctionData(
        "transfer",
        [this.txSigner.address, value] // transfer funds back to self
      );

    return new OperationRequestBuilder()
      .unwrap(asset, value)
      .action(simpleErc20.address, transferData)
      .chainId(BigInt(await this.txSigner.getChainId()))
      .deadline(
        BigInt((await this.txSigner.provider.getBlock("latest")).timestamp) +
          ONE_DAY_SECONDS
      )
      .gasPrice(
        ((await this.txSigner.provider.getGasPrice()).toBigInt() * 12n) / 10n
      )
      .build();
  }
}

function randomInt(max: number) {
  return Math.floor(Math.random() * max);
}

function randomBigIntBounded(max: bigint) {
  return randomBigInt() % max;
}

function randomBigintInRange(min: bigint, max: bigint) {
  return randomBigIntBounded(max - min) + min;
}

function randomElem<T>(arr: T[]): T {
  if (arr.length === 0) {
    throw new Error("cannot get random element from empty array");
  }

  return arr[randomInt(arr.length)];
}

function flipCoin(): boolean {
  return Math.random() < 0.5;
}
