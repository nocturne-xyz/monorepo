import {
  NocturneConfig,
  loadNocturneConfigBuiltin,
} from "@nocturne-xyz/config";
import { CanonAddress, StealthAddress } from "../crypto";
import {
  ConfidentialPayment,
  JoinSplitRequest,
  OperationGasParams,
  OperationRequestWithMetadata,
  OperationRequest,
  UnwrapRequest,
  ConfidentialPaymentRequest,
  RefundRequest,
} from "./operationRequest";
import {
  Action,
  Address,
  Asset,
  AssetTrait,
  OperationMetadata,
  OperationMetadataItem,
} from "../primitives";
import { ethers } from "ethers";
import { groupByArr } from "../utils";
import { chainIdToNetworkName } from "../utils/constants";

export type OpRequestBuilder = OpRequestBuilderExt<BaseOpRequestBuilder>;

export interface BuilderItemToProcess {
  unwraps: UnwrapRequest[];
  confidentialPayments: ConfidentialPaymentRequest[];
  refunds: RefundRequest[];
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
  provider: ethers.providers.Provider;
  config: NocturneConfig;

  _op: OperationRequest;
  _builderItemsToProcess: Promise<BuilderItemToProcess>[];

  build(): Promise<OperationRequestWithMetadata>;

  // add a plugin promise to await, resolves to unwraps, refunds, and actions to enqueue
  // returns `this` so it's chainable
  pluginFn(pluginPromise: Promise<BuilderItemToProcess>): this;

  // add an action  to the operation
  // returns `this` so it's chainable
  /// CAUTION: this is a low-level method that should only be used by plugins
  __action(contractAddress: Address, encodedFunction: string): this;

  // specify the operation should unwrap `amountUnits` of `asset`
  // `ammountUnits` is the amount in EVM (uint256) representation. It is up to
  // the caller to handle decimal conversions
  // returns `this` so it's chainable
  /// CAUTION: this is a low-level method that should only be used by plugins
  __unwrap(asset: Asset, amountUnits: bigint): this;

  // add a confidential payment to the operation
  // returns `this` so it's chainable
  confidentialPayment(
    asset: Asset,
    amountUnits: bigint,
    receiver: CanonAddress
  ): this;

  // indicates that the operation expects a refund of asset `Asset`.
  /// CAUTION: this is a low-level method that should only be used by plugins
  __refund(refund: RefundRequest): this;

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
  provider: ethers.providers.Provider,
  chainId: bigint,
  config?: NocturneConfig // use override config instead of defaulting to builtin for chainid (for testing purposes)
): OpRequestBuilderExt<BaseOpRequestBuilder> {
  if (!config) {
    const networkName = chainIdToNetworkName(chainId);
    config = loadNocturneConfigBuiltin(networkName);
  }

  const tellerContract = config.tellerAddress();
  const _op: OperationRequest = {
    chainId,
    tellerContract,
    joinSplitRequests: [],
    refunds: [],
    actions: [],
    deadline: 0n,
  };

  const _builderItemsToProcess: Promise<BuilderItemToProcess>[] = [];

  return {
    provider,
    config,
    _op,
    _builderItemsToProcess,

    use<E2 extends BaseOpRequestBuilder>(
      plugin: OpRequestBuilderPlugin<BaseOpRequestBuilder, E2>
    ): OpRequestBuilderExt<E2> {
      return plugin(this);
    },

    pluginFn(pluginPromise: Promise<BuilderItemToProcess>) {
      this._builderItemsToProcess.push(pluginPromise);
      return this;
    },

    __action(contractAddress: Address, encodedFunction: string) {
      const action: Action = {
        contractAddress: ethers.utils.getAddress(contractAddress),
        encodedFunction,
      };

      this._builderItemsToProcess.push(
        Promise.resolve({
          unwraps: [],
          confidentialPayments: [],
          refunds: [],
          actions: [action],
          metadatas: [],
        })
      );

      return this;
    },

    __unwrap(asset: Asset, amountUnits: bigint) {
      const unwrap: UnwrapRequest = {
        asset,
        unwrapValue: amountUnits,
      };

      this._builderItemsToProcess.push(
        Promise.resolve({
          unwraps: [unwrap],
          confidentialPayments: [],
          refunds: [],
          actions: [],
          metadatas: [],
        })
      );

      return this;
    },

    confidentialPayment(
      asset: Asset,
      amountUnits: bigint,
      receiver: CanonAddress
    ) {
      const payment: ConfidentialPaymentRequest = {
        value: amountUnits,
        receiver,
        asset,
      };

      this._builderItemsToProcess.push(
        Promise.resolve({
          unwraps: [],
          confidentialPayments: [payment],
          refunds: [],
          actions: [],
          metadatas: [],
        })
      );

      return this;
    },

    __refund(refund: RefundRequest) {
      this._builderItemsToProcess.push(
        Promise.resolve({
          unwraps: [],
          confidentialPayments: [],
          refunds: [refund],
          actions: [],
          metadatas: [],
        })
      );
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
      const joinSplitsAndPaymentsByAsset: Map<
        Asset,
        JoinSplitsAndPaymentsForAsset
      > = new Map();
      const metadata: OperationMetadata = {
        items: [],
      };

      // Await any promises resolving to items to process, then process items
      for (const prom of this._builderItemsToProcess) {
        const result = await prom;

        for (const { asset, unwrapValue } of result.unwraps) {
          const joinSplit: JoinSplitRequest = {
            asset,
            unwrapValue,
          };

          const [joinSplits, payments] = joinSplitsAndPaymentsByAsset.get(
            asset
          ) ?? [[], []];
          joinSplits.push(joinSplit);
          joinSplitsAndPaymentsByAsset.set(asset, [joinSplits, payments]);
        }
        for (const { asset, value, receiver } of result.confidentialPayments) {
          const payment: ConfidentialPayment = {
            value,
            receiver,
          };

          const [joinSplits, payments] = joinSplitsAndPaymentsByAsset.get(
            asset
          ) ?? [[], []];
          payments.push(payment);
          joinSplitsAndPaymentsByAsset.set(asset, [joinSplits, payments]);

          metadata.items.push({
            type: "ConfidentialPayment",
            recipient: receiver,
            asset,
            amount: value,
          });
        }
        for (const { contractAddress, encodedFunction } of result.actions) {
          const action: Action = {
            contractAddress: ethers.utils.getAddress(contractAddress),
            encodedFunction,
          };
          this._op.actions.push(action);
        }
        for (const refund of result.refunds) {
          this._op.refunds.push({
            encodedAsset: AssetTrait.encode(refund.asset),
            minRefundValue: refund.minRefundValue,
          });
        }
        for (const metadataItem of result.metadatas) {
          metadata.items.push(metadataItem);
        }
      }

      // consolidate joinSplits and payments for each asset
      const joinSplitRequests = [];
      for (const [
        asset,
        [joinSplits, payments],
      ] of joinSplitsAndPaymentsByAsset.entries()) {
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

      return {
        request: this._op,
        meta: metadata,
      };
    },
  };
}
