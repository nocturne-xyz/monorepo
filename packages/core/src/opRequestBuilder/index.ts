import { loadNocturneConfigBuiltin } from "@nocturne-xyz/config";
import { CanonAddress, StealthAddress } from "../crypto";
import {
  ConfidentialPayment,
  JoinSplitRequest,
  OperationGasParams,
  OperationRequestWithMetadata,
} from "../primitives/operationRequest";
import { Action, Address, Asset, NetworkInfo } from "../primitives";
import { ethers } from "ethers";
import { groupByArr } from "../utils";
import {
  BaseOpRequestBuilder,
  OpRequestBuilderExt,
  OpRequestBuilderPlugin,
} from "./types";
export { Erc20Plugin } from "./Erc20Plugin";

export type OpRequestBuilder = OpRequestBuilderExt<BaseOpRequestBuilder>;

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

  return {
    _op,
    _metadata,
    _joinSplitsAndPaymentsByAsset,

    use<E2 extends BaseOpRequestBuilder>(
      plugin: OpRequestBuilderPlugin<BaseOpRequestBuilder, E2>
    ): OpRequestBuilderExt<E2> {
      return plugin(this);
    },

    // add an action  to the operation
    // returns `this` so it's chainable
    action(contractAddress: Address, encodedFunction: string) {
      const action: Action = {
        contractAddress: ethers.utils.getAddress(contractAddress),
        encodedFunction,
      };
      this._op.actions.push(action);
      return this;
    },

    // specify the operation should unwrap `amountUnits` of `asset`
    // `ammountUnits` is the amount in EVM (uint256) representation. It is up to
    // the caller to handle decimal conversions
    // returns `this` so it's chainable
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

    // add a confidential payment to the operation
    // returns `this` so it's chainable
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

    // indicates that the operation expects a refund of asset `Asset`.
    refundAsset(asset: Asset) {
      this._op.refundAssets.push(asset);
      return this;
    },

    // Set the stealth address `refundAddr` up-front.
    // if this is not set, the wallet will generate a new one
    // returns `this` so it's chainable
    refundAddr(addr: StealthAddress) {
      this._op.refundAddr = addr;
      return this;
    },

    // Attach deadline to operation
    deadline(deadline: bigint) {
      this._op.deadline = deadline;
      return this;
    },

    // Specify gas parameters up-front.
    // this is optional - if not given, the SDK will estimate it for you.
    // it's recommended to just let the SDK estimate this instead.
    // returns `this` so it's chainable
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

    build(): OperationRequestWithMetadata {
      const joinSplitRequests = [];

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

      return {
        request: this._op,
        meta: this._metadata,
      };
    },
  };
}
