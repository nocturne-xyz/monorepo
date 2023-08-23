import { Erc20Config } from "@nocturne-xyz/config";
import {
  DepositManager,
  SimpleERC20Token__factory,
  Teller,
} from "@nocturne-xyz/contracts";
import { DepositInstantiatedEvent } from "@nocturne-xyz/contracts/dist/src/DepositManager";
import {
  Address,
  Asset,
  JoinSplitProver,
  NocturneClient,
  OperationRequest,
  newOpRequestBuilder,
  OperationRequestWithMetadata,
  StealthAddressTrait,
  computeOperationDigest,
  min,
  parseEventsFromContractReceipt,
  proveOperation,
  sleep,
  signOperation,
  NocturneSigner,
} from "@nocturne-xyz/core";
import {
  makeCreateCounterFn,
  makeCreateHistogramFn,
} from "@nocturne-xyz/offchain-utils";
import randomBytes from "randombytes";
import * as ot from "@opentelemetry/api";
import * as JSON from "bigint-json-serialization";
import { ethers } from "ethers";
import { Logger } from "winston";

export const ACTOR_NAME = "test-actor";
const COMPONENT_NAME = "main";

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

export interface TestActorMetrics {
  instantiatedDepositsCounter: ot.Counter;
  instantiatedDepositsValueHistogram: ot.Histogram;
  dispatchedOperationsCounter: ot.Counter;
  dispatchedOperationsValueOutHistogram: ot.Histogram;
}

export class TestActor {
  provider: ethers.providers.Provider;
  txSigner: ethers.Signer;
  teller: Teller;
  depositManager: DepositManager;
  nocturneSigner: NocturneSigner;
  client: NocturneClient;
  prover: JoinSplitProver;
  bundlerEndpoint: string;
  erc20s: Map<string, Erc20Config>;
  logger: Logger;
  metrics: TestActorMetrics;

  _chainId?: bigint;
  _address?: Address;

  constructor(
    provider: ethers.providers.Provider,
    txSigner: ethers.Signer,
    teller: Teller,
    depositManager: DepositManager,
    nocturneSigner: NocturneSigner,
    client: NocturneClient,
    prover: JoinSplitProver,
    bundlerEndpoint: string,
    erc20s: Map<string, Erc20Config>,
    logger: Logger
  ) {
    this.provider = provider;
    this.txSigner = txSigner;
    this.teller = teller;
    this.depositManager = depositManager;
    this.nocturneSigner = nocturneSigner;
    this.client = client;
    this.prover = prover;
    this.bundlerEndpoint = bundlerEndpoint;

    this.erc20s = erc20s;
    this.logger = logger;

    const meter = ot.metrics.getMeter(COMPONENT_NAME);
    const createCounter = makeCreateCounterFn(
      meter,
      ACTOR_NAME,
      COMPONENT_NAME
    );
    const createHistogram = makeCreateHistogramFn(
      meter,
      ACTOR_NAME,
      COMPONENT_NAME
    );

    this.metrics = {
      instantiatedDepositsCounter: createCounter(
        "instantiated_deposits.counter",
        "Number of deposits instantiated"
      ),
      instantiatedDepositsValueHistogram: createHistogram(
        "instantiated_deposits_value.histogram",
        "Histogram of value of deposits instantiated"
      ),
      dispatchedOperationsCounter: createCounter(
        "dispatched_operations.counter",
        "Number of operations dispatched"
      ),
      dispatchedOperationsValueOutHistogram: createHistogram(
        "dispatched_operations_value_out.counter",
        "Histogram of outgoing value of operations dispatched"
      ),
    };
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
      await this.client.sync();
      const balances = await this.client.getAllAssetBalances();
      this.logger.info("balances: ", balances);

      if (batchEvery && i !== 0 && i % batchEvery === 0) {
        this.logger.info("performing 8 operations to fill a bundle");
        for (let j = 0; j < 8; j++) {
          await this.randomOperation();
        }
      } else {
        this.logger.info("performing operation");
        await this.randomOperation();
      }

      this.logger.info(`sleeping for ${interval} seconds`);
      await sleep(interval);
      i++;
    }
  }

  async run(opts?: TestActorOpts): Promise<void> {
    // set chainid
    this._chainId = BigInt(await this.txSigner.getChainId());
    this._address = await this.txSigner.getAddress();

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
    const assetsWithBalance = await this.client.getAllAssetBalances();
    if (assetsWithBalance.length === 0) {
      this.logger.warn("test-actor has no asset balances");
      return undefined;
    }

    // Try for random asset
    const randomAsset = randomElem(assetsWithBalance);

    // If random chosen doesn't have any funds, find the first one with funds
    if (randomAsset.balance > 0) {
      const maxValue = min(randomAsset.balance / 1_000_000n, 1_000_000n);
      const value = randomBigIntBounded(maxValue);
      return [randomAsset.asset, value];
    } else {
      for (const asset of assetsWithBalance) {
        if (asset.balance > 0) {
          const maxValue = min(randomAsset.balance / 1_000_000n, 1_000_000n);
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
      this._address!,
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
          this.client.viewer.generateRandomStealthAddress()
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

    const labels = {
      spender: this._address!,
      assetAddr: erc20Token.address,
    };
    this.metrics.instantiatedDepositsCounter.add(1, labels);
    this.metrics.instantiatedDepositsValueHistogram.record(
      Number(randomValue),
      labels
    ); // we assume we cap max deposit size to be < 2^53

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
      opRequest = (await this.erc20TransferOpRequest(asset, value)).request;
    } else {
      // TODO: add swapper call case and replace if(true) with flipcoin
    }

    // prepare, sign, and prove
    try {
      const preSign = await this.client.prepareOperation(opRequest);
      const signed = signOperation(this.nocturneSigner, preSign);
      await this.client.applyOptimisticRecordsForOp(signed);

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
      this.logger.info(`submitting operation with digest ${opDigest}`, {
        operation: proven,
      });
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

      const labels = {
        spender: this._address!,
        assetAddr: asset.assetAddr,
      };
      this.metrics.dispatchedOperationsCounter.add(1, labels);
      this.metrics.dispatchedOperationsValueOutHistogram.record(
        Number(value),
        labels
      ); // we assume we cap max deposit size to be < 2^53

      return true;
    } catch (err) {
      this.logger.error(`failed to perform operation`, { err });
      if (
        err instanceof Error &&
        err.message.includes("not enough owned gas tokens")
      ) {
        return false;
      }

      throw err;
    }
  }

  private async erc20TransferOpRequest(
    asset: Asset,
    value: bigint
  ): Promise<OperationRequestWithMetadata> {
    const simpleErc20 = SimpleERC20Token__factory.connect(
      asset.assetAddr,
      this.txSigner
    );
    const transferData =
      SimpleERC20Token__factory.createInterface().encodeFunctionData(
        "transfer",
        [this._address!, value] // transfer funds back to self
      );

    const chainId = this._chainId ?? BigInt(await this.txSigner.getChainId());

    return newOpRequestBuilder({
      chainId,
      tellerContract: this.teller.address,
    })
      .unwrap(asset, value)
      .action(simpleErc20.address, transferData)
      .deadline(
        BigInt((await this.provider.getBlock("latest")).timestamp) +
          ONE_DAY_SECONDS
      )
      .gasPrice(((await this.provider.getGasPrice()).toBigInt() * 14n) / 10n)
      .build();
  }
}

function randomInt(max: number) {
  return Math.floor(Math.random() * max);
}

function randomBigIntBounded(max: bigint) {
  const maxBytes = max.toString(16).length / 2;
  const bytes = randomBytes(maxBytes);
  return BigInt("0x" + bytes.toString("hex")) % max;
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
