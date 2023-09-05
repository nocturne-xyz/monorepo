import { loadNocturneConfigBuiltin } from "@nocturne-xyz/config";
import { CanonAddress, StealthAddress } from "../crypto";
import {
  ConfidentialPayment,
  JoinSplitRequest,
  OperationGasParams,
  OperationRequestWithMetadata,
  OperationRequest,
  UnwrapRequest,
} from "./operationRequest";
import {
  Action,
  Address,
  Asset,
  NetworkInfo,
  OperationMetadata,
  OperationMetadataItem,
} from "../primitives";
import { ethers } from "ethers";
import { groupByArr } from "../utils";

export type OpRequestBuilder = OpRequestBuilderExt<BaseOpRequestBuilder>;

export interface PluginFnResult {
  unwraps: UnwrapRequest[];
  refundAssets: Asset[];
  actions: Action[];
  metadatas: OperationMetadataItem[];
}

// generic type for an `OpRequestBuilder` that can be "extended" via plugins
export type OpRequestBuilderExt<E extends BaseOpRequestBuilder> = E & {
  // "extend" the builder's functionality by applying a `plugin`
  use<E2 extends E>(
    plugin: OpRequestBuilderPlugin<E, E2>
  ): OpRequestBuilderExt<E2>;
};

// methods that are available by default on any implementor of `OpRequestBuilderExt`
export interface BaseOpRequestBuilder {
  _op: OperationRequest;
  _metadata: OperationMetadata;
  _joinSplitsAndPaymentsByAsset: Map<Asset, JoinSplitsAndPaymentsForAsset>;
  _pluginFnPromises: Promise<PluginFnResult>[];

  build(): Promise<OperationRequestWithMetadata>;

  // add a plugin promise to await, resolves to unwraps, refunds, and actions to enqueue
  // returns `this` so it's chainable
  pluginFn(pluginPromise: Promise<PluginFnResult>): this;

  // add an action  to the operation
  // returns `this` so it's chainable
  action(contractAddress: Address, encodedFunction: string): this;

  // specify the operation should unwrap `amountUnits` of `asset`
  // `ammountUnits` is the amount in EVM (uint256) representation. It is up to
  // the caller to handle decimal conversions
  // returns `this` so it's chainable
  unwrap(asset: Asset, amountUnits: bigint): this;

  // add a confidential payment to the operation
  // returns `this` so it's chainable
  confidentialPayment(
    asset: Asset,
    amountUnits: bigint,
    receiver: CanonAddress
  ): this;

  // indicates that the operation expects a refund of asset `Asset`.
  refundAsset(asset: Asset): this;

  // set the operation's `refundAddr` stealth address up-front.
  // if this is not set, the wallet will generate a new one
  // returns `this` so it's chainable
  refundAddr(addr: StealthAddress): this;

  // set deadline to operation
  // TODO: what's the unit?
  deadline(deadline: bigint): this;

  // Specify gas parameters up-front.
  // this is optional - if not given, the SDK will estimate it for you.
  // it's recommended to just let the SDK estimate this instead.
  // returns `this` so it's chainable
  gas(gasParams: OperationGasParams): this;
  gasPrice(gasPrice: bigint): this;
}

// an `OpRequestBuilder` plugin
// this is simply a function from `OpRequestBuilderExt<E>` to `OpRequestBuilderExt<E2>`,
// where `E2` extends `E`, and both represent the extra "stuff" the plugin adds to the builder,
// which may include arbitrary properties and/or methods
export type OpRequestBuilderPlugin<
  E extends BaseOpRequestBuilder,
  E2 extends E
> = (inner: OpRequestBuilderExt<E>) => OpRequestBuilderExt<E2>;

// utility type used in `OpRequestBuilder` to match together
// conf payments and join split requests
export type JoinSplitsAndPaymentsForAsset = [
  JoinSplitRequest[],
  ConfidentialPayment[]
];

// the base OpRequestBuilder. This is the only thing users should explicitly construct.
// to add functionality (erc20s, protocol integrations, etc), user should call `.use(plugin)` with the relevant plugin
export function newOpRequestBuilder(
  network: string | NetworkInfo
): OpRequestBuilderExt<BaseOpRequestBuilder> {
  let chainId: bigint;
  let tellerContract: Address;
  if (typeof network === "string") {
    const config = loadNocturneConfigBuiltin(network);
    chainId = BigInt(config.contracts.network.chainId);
    tellerContract = config.tellerAddress();
  } else {
    chainId = network.chainId;
    tellerContract = network.tellerContract;
  }

  const _op = {
    chainId,
    tellerContract,
    joinSplitRequests: [],
    refundAssets: [],
    actions: [],
    deadline: 0n,
  };

  const _metadata = {
    items: [],
  };

  const _joinSplitsAndPaymentsByAsset = new Map();

  const _pluginFnPromises: Promise<PluginFnResult>[] = [];

  return {
    _op,
    _metadata,
    _joinSplitsAndPaymentsByAsset,
    _pluginFnPromises,

    use<E2 extends BaseOpRequestBuilder>(
      plugin: OpRequestBuilderPlugin<BaseOpRequestBuilder, E2>
    ): OpRequestBuilderExt<E2> {
      return plugin(this);
    },

    pluginFn(pluginPromise: Promise<PluginFnResult>) {
      this._pluginFnPromises.push(pluginPromise);
      return this;
    },

    action(contractAddress: Address, encodedFunction: string) {
      const action: Action = {
        contractAddress: ethers.utils.getAddress(contractAddress),
        encodedFunction,
      };
      this._op.actions.push(action);
      return this;
    },

    unwrap(asset: Asset, amountUnits: bigint) {
      const joinSplit: JoinSplitRequest = {
        asset,
        unwrapValue: amountUnits,
      };

      const [joinSplits, payments] = this._joinSplitsAndPaymentsByAsset.get(
        asset
      ) ?? [[], []];
      joinSplits.push(joinSplit);
      this._joinSplitsAndPaymentsByAsset.set(asset, [joinSplits, payments]);

      return this;
    },

    confidentialPayment(
      asset: Asset,
      amountUnits: bigint,
      receiver: CanonAddress
    ) {
      const payment: ConfidentialPayment = {
        value: amountUnits,
        receiver,
      };

      const [joinSplits, payments] = this._joinSplitsAndPaymentsByAsset.get(
        asset
      ) ?? [[], []];
      payments.push(payment);
      this._joinSplitsAndPaymentsByAsset.set(asset, [joinSplits, payments]);

      this._metadata.items.push({
        type: "ConfidentialPayment",
        recipient: receiver,
        asset,
        amount: amountUnits,
      });
      return this;
    },

    refundAsset(asset: Asset) {
      this._op.refundAssets.push(asset);
      return this;
    },

    refundAddr(addr: StealthAddress) {
      this._op.refundAddr = addr;
      return this;
    },

    deadline(deadline: bigint) {
      this._op.deadline = deadline;
      return this;
    },

    gas(gasParams: OperationGasParams) {
      const { executionGasLimit, gasPrice } = gasParams;
      this._op.executionGasLimit = executionGasLimit;
      this._op.gasPrice = gasPrice;
      return this;
    },

    gasPrice(gasPrice: bigint) {
      this._op.gasPrice = gasPrice;
      return this;
    },

    async build(): Promise<OperationRequestWithMetadata> {
      const joinSplitRequests = [];

      // Await plugin promises and update op
      for (const prom of this._pluginFnPromises) {
        const result = await prom;

        for (const unwrap of result.unwraps) {
          this.unwrap(unwrap.asset, unwrap.unwrapValue);
        }
        for (const action of result.actions) {
          this.action(action.contractAddress, action.encodedFunction);
        }
        for (const refundAsset of result.refundAssets) {
          this.refundAsset(refundAsset);
        }
        for (const metadata of result.metadatas) {
          this._metadata.items.push(metadata);
        }
      }

      // consolidate joinSplits and payments for each asset
      for (const [
        asset,
        [joinSplits, payments],
      ] of this._joinSplitsAndPaymentsByAsset.entries()) {
        // consolidate payments to the same receiver
        const paymentsByReceiver = groupByArr(payments, (p) =>
          p.receiver.toString()
        );
        const consolidatedPayments = paymentsByReceiver.flatMap((payments) => {
          if (payments.length === 0) {
            return [];
          }
          const value = payments.reduce(
            (acc, payment) => acc + payment.value,
            0n
          );
          const receiver = payments[0].receiver;
          return [{ value, receiver }];
        });

        // assign each payment to a joinsplit request. If there are not enough joinsplit requests, create new ones
        for (const payment of consolidatedPayments) {
          const joinSplit = joinSplits.pop();
          if (joinSplit) {
            joinSplit.payment = payment;
            joinSplitRequests.push(joinSplit);
          } else {
            joinSplitRequests.push({
              asset,
              unwrapValue: 0n,
              payment,
            });
          }
        }

        // consolidate any remaining unassigned joinsplit requests
        if (joinSplits.length > 0) {
          const value = joinSplits.reduce(
            (acc, joinSplit) => acc + joinSplit.unwrapValue,
            0n
          );
          joinSplitRequests.push({
            asset,
            unwrapValue: value,
          });
        }
      }

      this._op.joinSplitRequests = joinSplitRequests;

      if (this._op.joinSplitRequests.length == 0) {
        throw new Error("No joinSplits or payments specified");
      }

      return Promise.resolve({
        request: this._op,
        meta: this._metadata,
      });
    },
  };
}
