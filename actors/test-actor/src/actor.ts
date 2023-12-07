import {
  NocturneClient,
  OperationRequest,
  OperationRequestWithMetadata,
  newOpRequestBuilder,
  proveOperation,
  signOperation,
} from "@nocturne-xyz/client";
import { Erc20Config, NocturneConfig } from "@nocturne-xyz/config";
import {
  DepositManager,
  Handler,
  SimpleERC20Token__factory,
  Teller,
} from "@nocturne-xyz/contracts";
import {
  Address,
  Asset,
  GAS_PER_DEPOSIT_COMPLETE,
  JoinSplitProver,
  NocturneSigner,
  OperationTrait,
  StealthAddressTrait,
  min,
  sleep,
} from "@nocturne-xyz/core";
import {
  TxSubmitter,
  makeCreateCounterFn,
  makeCreateHistogramFn,
} from "@nocturne-xyz/offchain-utils";
import { Erc20Plugin } from "@nocturne-xyz/op-request-plugins";
import * as ot from "@opentelemetry/api";
import * as JSON from "bigint-json-serialization";
import { ethers } from "ethers";
import randomBytes from "randombytes";
import { Logger } from "winston";

export const ACTOR_NAME = "test-actor";
const COMPONENT_NAME = "main";

const ONE_MINUTE_AS_SECS = 60;
const ONE_DAY_SECONDS = 60n * 60n * 24n;
const ONE_ETH_IN_WEI = 10n ** 18n;

export class TestActorOpts {
  depositIntervalSeconds?: number;
  opIntervalSeconds?: number;
  syncIntervalSeconds?: number;
  opGasPriceMultiplier?: number;
  fullBundleEvery?: number;
  onlyDeposits?: boolean;
  onlyOperations?: boolean;
  onlySync?: boolean;
  finalityBlocks?: number;
}

export interface TestActorMetrics {
  instantiatedDepositsCounter: ot.Counter;
  instantiatedDepositsValueHistogram: ot.Histogram;
  dispatchedOperationsCounter: ot.Counter;
  dispatchedOperationsValueOutHistogram: ot.Histogram;
}

export class TestActor {
  provider: ethers.providers.JsonRpcProvider;
  txSubmitter: TxSubmitter;
  teller: Teller;
  depositManager: DepositManager;
  handler: Handler;
  nocturneSigner: NocturneSigner;
  client: NocturneClient;
  prover: JoinSplitProver;
  bundlerEndpoint: string;
  erc20s: Map<string, Erc20Config>;
  config: NocturneConfig;
  logger: Logger;
  metrics: TestActorMetrics;

  _chainId?: bigint;
  _address?: Address;

  constructor(
    provider: ethers.providers.JsonRpcProvider,
    txSubmitter: TxSubmitter,
    teller: Teller,
    depositManager: DepositManager,
    handler: Handler,
    nocturneSigner: NocturneSigner,
    client: NocturneClient,
    prover: JoinSplitProver,
    bundlerEndpoint: string,
    config: NocturneConfig,
    logger: Logger
  ) {
    this.provider = provider;
    this.txSubmitter = txSubmitter;
    this.teller = teller;
    this.depositManager = depositManager;
    this.handler = handler;
    this.nocturneSigner = nocturneSigner;
    this.client = client;
    this.prover = prover;
    this.bundlerEndpoint = bundlerEndpoint;

    this.config = config;
    this.erc20s = new Map(
      Array.from(config.erc20s.entries()).filter(([key]) =>
        key.toLowerCase().includes("test")
      )
    );
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

  async runOps(interval: number, opts?: TestActorOpts): Promise<void> {
    const { fullBundleEvery, finalityBlocks } = opts ?? {};

    let i = 0;
    while (true) {
      await this.client.sync({ finalityBlocks });
      const balances = await this.client.getAllAssetBalances();
      this.logger.info("balances: ", balances);

      if (fullBundleEvery && i !== 0 && i % fullBundleEvery === 0) {
        this.logger.info("performing 8 operations to fill a bundle");
        for (let j = 0; j < 8; j++) {
          await this.randomOperation(opts);
        }
      } else {
        this.logger.info("performing operation");
        await this.randomOperation(opts);
      }

      this.logger.info(`sleeping for ${interval} ms`);
      await sleep(interval);
      i++;
    }
  }

  async run(opts?: TestActorOpts): Promise<void> {
    // set chainid
    this._chainId = BigInt((await this.provider.getNetwork()).chainId);
    this._address = await this.txSubmitter.address();

    const depositIntervalSeconds =
      opts?.depositIntervalSeconds ?? ONE_MINUTE_AS_SECS;
    const opIntervalSeconds = opts?.opIntervalSeconds ?? ONE_MINUTE_AS_SECS;
    const syncIntervalSeconds = opts?.syncIntervalSeconds ?? ONE_MINUTE_AS_SECS;

    const pruneOptimsiticNullifiers = async () => {
      await this.client.pruneOptimisticNullifiers();
      setTimeout(pruneOptimsiticNullifiers, opIntervalSeconds);
    };
    void pruneOptimsiticNullifiers();

    if (opts?.onlyDeposits) {
      await this.runDeposits(depositIntervalSeconds * 1000);
    } else if (opts?.onlyOperations) {
      await this.runOps(opIntervalSeconds * 1000, opts);
    } else if (opts?.onlySync) {
      await this.runSyncOnly(syncIntervalSeconds * 1000);
    } else {
      await Promise.all([
        this.runDeposits(depositIntervalSeconds * 1000),
        this.runOps(opIntervalSeconds, opts),
      ]);
    }
  }

  private async runSyncOnly(syncInterval: number): Promise<void> {
    while (true) {
      await this.client.sync();
      const [latestSyncedMerkleIndex, latestCommittedMerkleIndex] =
        await Promise.all([
          this.client.getLatestSyncedMerkleIndex(),
          this.client.getLatestCommittedMerkleIndex(),
        ]);
      const currentTreeRoot = this.client.getCurrentTreeRoot();
      this.logger.info(
        `finished syncing to root ${currentTreeRoot}, committed index ${latestCommittedMerkleIndex}, latest index ${latestSyncedMerkleIndex}`,
        {
          latestSyncedMerkleIndex,
          latestCommittedMerkleIndex,
          currentTreeRoot: currentTreeRoot.toString(),
        }
      );

      try {
        const isPastRoot = await this.handler._pastRoots(currentTreeRoot);
        if (!isPastRoot) {
          this.logger.error(`current root ${currentTreeRoot} is not past root`);
          throw new Error("tree root not past root");
        }
      } catch (err) {
        this.logger.error(`failed to check if root is past root`, { err });
        throw err;
      }

      await sleep(syncInterval);
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
    try {
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
        this.provider
      );
      const reserveData = erc20Token.interface.encodeFunctionData(
        "reserveTokens",
        [this._address!, randomValue]
      );
      await this.txSubmitter.submitTransaction(
        {
          to: erc20Config.address,
          data: reserveData,
        },
        {
          numConfirmations: this.config.finalityBlocks,
          logger: this.logger,
        }
      );

      this.logger.info(
        `approving deposit manager for ${randomValue} of token "${erc20Config.address}"`,
        {
          tokenName: erc20Name,
          tokenAddress: erc20Config.address,
          amount: randomValue,
        }
      );

      const approveData = erc20Token.interface.encodeFunctionData("approve", [
        this.depositManager.address,
        50n * ONE_ETH_IN_WEI,
      ]);
      await this.txSubmitter.submitTransaction(
        {
          to: erc20Config.address,
          data: approveData,
        },
        {
          numConfirmations: this.config.finalityBlocks,
          logger: this.logger,
        }
      );

      // submit
      this.logger.info(
        `instantiating erc20 deposit request for ${randomValue} of token "${erc20Config.address}"`,
        {
          tokenName: erc20Name,
          tokenAddress: erc20Config.address,
          amount: randomValue,
        }
      );

      const stealthAddress = StealthAddressTrait.compress(
        this.client.viewer.generateRandomStealthAddress()
      );
      const gasPrice = (await this.provider.getGasPrice()).toBigInt();
      const gasCompensation = GAS_PER_DEPOSIT_COMPLETE * gasPrice;

      const estimatedGas = (
        await this.depositManager.estimateGas.instantiateErc20MultiDeposit(
          erc20Token.address,
          [randomValue],
          stealthAddress,
          {
            from: this._address!,
            value: gasCompensation,
          }
        )
      ).toBigInt();

      const depositData = this.depositManager.interface.encodeFunctionData(
        "instantiateErc20MultiDeposit",
        [erc20Token.address, [randomValue], stealthAddress]
      );
      await this.txSubmitter.submitTransaction(
        {
          to: this.depositManager.address,
          data: depositData,
        },
        {
          numConfirmations: this.config.finalityBlocks,
          gasLimit: Number((estimatedGas * 3n) / 2n),
          logger: this.logger,
        }
      );

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
    } catch (err) {
      this.logger.error(`failed to perform deposit`, { err });
      return false;
    }
  }

  private async randomOperation(opts?: TestActorOpts): Promise<boolean> {
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
      const preSign = await this.client.prepareOperation(
        opRequest,
        opts?.opGasPriceMultiplier ?? 1
      );
      const signed = signOperation(this.nocturneSigner, preSign);

      const opDigest = OperationTrait.computeDigest(signed);
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

      await this.client.addOpToHistory(signed, { items: [] });

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
    const chainId =
      this._chainId ?? BigInt((await this.provider.getNetwork()).chainId);
    const gasPrice = (await this.provider.getGasPrice()).toBigInt();
    return newOpRequestBuilder(this.provider, chainId)
      .use(Erc20Plugin)
      .erc20Transfer(asset.assetAddr, this._address!, value)
      .gasPrice((gasPrice * 3n) / 2n)
      .deadline(
        BigInt((await this.provider.getBlock("latest")).timestamp) +
          ONE_DAY_SECONDS
      )
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
