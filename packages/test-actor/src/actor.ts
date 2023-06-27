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
  min,
} from "@nocturne-xyz/sdk";
import * as JSON from "bigint-json-serialization";
import { Erc20Config } from "@nocturne-xyz/config";
import { ethers } from "ethers";
import { DepositInstantiatedEvent } from "@nocturne-xyz/contracts/dist/src/DepositManager";
import { Logger } from "winston";

const ONE_MINUTE_AS_SECS = 60;
const ONE_DAY_SECONDS = 60n * 60n * 24n;
const ONE_ETH_IN_WEI = 10n ** 18n;

export class TestActorOpts {
  depositIntervalSeconds?: number;
  opIntervalSeconds?: number;
  fullBundleEvery?: number;
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
  logger: Logger;

  constructor(
    txSigner: ethers.Wallet,
    teller: Teller,
    depositManager: DepositManager,
    sdk: NocturneWalletSDK,
    prover: JoinSplitProver,
    bundlerEndpoint: string,
    erc20s: Map<string, Erc20Config>,
    logger: Logger
  ) {
    this.txSigner = txSigner;
    this.teller = teller;
    this.depositManager = depositManager;
    this.sdk = sdk;
    this.prover = prover;
    this.bundlerEndpoint = bundlerEndpoint;

    this.erc20s = erc20s;
    this.logger = logger;
  }

  async runDeposits(interval: number): Promise<void> {
    while (true) {
      await this.deposit();
      await sleep(interval);
    }
  }

  async runOps(interval: number, batchEvery?: number): Promise<void> {
    let i = 0;
    while (true) {
      await this.sdk.sync();
      const balances = await this.sdk.getAllAssetBalances();
      this.logger.info("balances: ", balances);

      let actionTaken = false;
      if (batchEvery && i % batchEvery === 0) {
        this.logger.info("performing 8 operations to fill a bundle");
        for (let j = 0; j < 8; j++) {
          actionTaken = await this.randomOperation();
        }
      } else {
        this.logger.info("performing operation");
        actionTaken = await this.randomOperation();
      }

      if (actionTaken) {
        this.logger.info(`sleeping for ${interval} seconds`);
        await sleep(interval);
      }
      i++;
    }
  }

  async run(opts?: TestActorOpts): Promise<void> {
    const depositIntervalSeconds =
      opts?.depositIntervalSeconds ?? ONE_MINUTE_AS_SECS;
    const opIntervalSeconds = opts?.opIntervalSeconds ?? ONE_MINUTE_AS_SECS;

    if (opts?.onlyDeposits) {
      await this.runDeposits(depositIntervalSeconds * 1000);
    } else if (opts?.onlyOperations) {
      await this.runOps(opIntervalSeconds * 1000, 1);
    } else {
      await Promise.all([
        this.runDeposits(depositIntervalSeconds * 1000),
        this.runOps(opIntervalSeconds * 1000, opts?.fullBundleEvery),
      ]);
    }
  }

  private async getRandomErc20AndValue(): Promise<[Asset, bigint] | undefined> {
    const assetsWithBalance = await this.sdk.getAllAssetBalances();
    if (assetsWithBalance.length === 0) {
      this.logger.warn("test-actor has no asset balances");
      return undefined;
    }

    // Try for random asset
    const randomAsset = randomElem(assetsWithBalance);

    // If random chosen doesn't have any funds, find the first one with funds
    if (randomAsset.balance > 0) {
      const maxValue = min(randomAsset.balance / 1000n, ONE_ETH_IN_WEI);
      const value = randomBigIntBounded(maxValue);
      return [randomAsset.asset, value];
    } else {
      for (const asset of assetsWithBalance) {
        if (asset.balance > 0) {
          const maxValue = min(randomAsset.balance / 1000n, ONE_ETH_IN_WEI);
          const value = randomBigIntBounded(maxValue);
          return [asset.asset, value];
        }
      }
    }

    return undefined;
  }

  private async deposit(): Promise<boolean> {
    // choose a random deposit request and set its nonce
    this.logger.debug(`${this.erc20s.size} possible erc20s`, {
      erc20s: Array.from(this.erc20s.entries()),
    });
    const [erc20Name, erc20Config] = randomElem(
      Array.from(this.erc20s.entries())
    );
    const randomValue = randomBigintInRange(
      10n * ONE_ETH_IN_WEI,
      50n * ONE_ETH_IN_WEI
    );

    this.logger.info(
      `reserving ${randomValue} of token "${erc20Config.address}"`,
      {
        tokenName: erc20Name,
        tokenAddress: erc20Config.address,
        amount: randomValue,
      }
    );

    const erc20Token = SimpleERC20Token__factory.connect(
      erc20Config.address,
      this.txSigner
    );
    const reserveTx = await erc20Token.reserveTokens(
      this.txSigner.address,
      randomValue
    );
    await reserveTx.wait(1);

    this.logger.info(
      `approving deopsit manager for ${randomValue} of token "${erc20Config.address}"`,
      {
        tokenName: erc20Name,
        tokenAddress: erc20Config.address,
        amount: randomValue,
      }
    );

    const approveTx = await erc20Token.approve(
      this.depositManager.address,
      randomValue
    );
    await approveTx.wait(1);

    // submit
    this.logger.info(
      `instantiating erc20 deposit request for ${randomValue} of token "${erc20Config.address}"`,
      {
        tokenName: erc20Name,
        tokenAddress: erc20Config.address,
        amount: randomValue,
      }
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
    this.logger.debug("matching events from transaction receipt", {
      matchingEvents,
    });

    return true;
  }

  private async randomOperation(): Promise<boolean> {
    // choose a random joinsplit asset for oprequest
    const maybeErc20AndValue = await this.getRandomErc20AndValue();
    if (!maybeErc20AndValue) {
      return false;
    }
    const [asset, value] = maybeErc20AndValue;

    this.logger.info(
      `Attempting operation that spends ${value} of token ${asset.assetAddr}`,
      {
        tokenAddress: asset.assetAddr,
        amount: value,
      }
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

    const opDigest = computeOperationDigest(signed);
    this.logger.info(`proving operation with digest ${opDigest}`, {
      opDigest,
      signedOp: signed,
    });

    const proven = await proveOperation(this.prover, signed);
    this.logger.info(`proved operation with digest ${opDigest}`, {
      provenOp: proven,
    });

    // submit
    this.logger.info(`submitting operation with digest ${opDigest}`);
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

    this.logger.info(
      `successfully submitted operation with digest ${opDigest}`
    );

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
        ((await this.txSigner.provider.getGasPrice()).toBigInt() * 14n) / 10n
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
