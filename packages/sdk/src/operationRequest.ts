import { Asset, Address, Action } from "./primitives";
import { CanonAddress, StealthAddress } from "./crypto";
import { groupByArr } from "./utils";

// A joinsplit request is an unwrapRequest plus an optional payment
export interface JoinSplitRequest {
  asset: Asset;
  unwrapValue: bigint;
  payment?: ConfidentialPayment;
}

export interface OperationRequest {
  joinSplitRequests: JoinSplitRequest[];
  refundAssets: Asset[];
  actions: Action[];
  chainId: bigint;
  deadline: bigint;
  refundAddr?: StealthAddress;
  executionGasLimit?: bigint;
  maxNumRefunds?: bigint;
  gasPrice?: bigint;
}

export interface GasAccountedOperationRequest
  extends Omit<
    OperationRequest,
    "executionGasLimit" | "maxNumRefunds" | "gasPrice"
  > {
  executionGasLimit: bigint;
  maxNumRefunds: bigint;
  gasPrice: bigint;
  gasAsset: Asset;
}

export interface OperationGasParams {
  executionGasLimit: bigint;
  gasPrice: bigint;
}

type JoinSplitsAndPaymentsForAsset = [
  JoinSplitRequest[],
  ConfidentialPayment[]
];

interface ConfidentialPayment {
  value: bigint;
  receiver: CanonAddress;
}

export class OperationRequestBuilder {
  private op: OperationRequest;
  private joinSplitsAndPaymentsByAsset: Map<
    Asset,
    JoinSplitsAndPaymentsForAsset
  >;

  // constructor takes no parameters. `new NocturneOperationBuilder()`
  constructor() {
    this.op = {
      joinSplitRequests: [],
      refundAssets: [],
      actions: [],
      chainId: 0n,
      deadline: 0n,
    };

    this.joinSplitsAndPaymentsByAsset = new Map();
  }

  // add an action  to the operation
  // returns `this` so it's chainable
  action(
    contractAddress: Address,
    encodedFunction: string
  ): OperationRequestBuilder {
    const action: Action = {
      contractAddress,
      encodedFunction,
    };

    this.op.actions.push(action);
    return this;
  }

  // specify the operation should unwrap `amountUnits` of `asset`
  // `ammountUnits` is the amount in EVM (uint256) representation. It is up to
  // the caller to handle decimal conversions
  // returns `this` so it's chainable
  unwrap(asset: Asset, amountUnits: bigint): OperationRequestBuilder {
    const joinSplit: JoinSplitRequest = {
      asset,
      unwrapValue: amountUnits,
    };

    const [joinSplits, payments] = this.joinSplitsAndPaymentsByAsset.get(
      asset
    ) ?? [[], []];
    joinSplits.push(joinSplit);
    this.joinSplitsAndPaymentsByAsset.set(asset, [joinSplits, payments]);

    return this;
  }

  // add a confidential payment to the operation
  // returns `this` so it's chainable
  confidentialPayment(
    asset: Asset,
    amountUnits: bigint,
    receiver: CanonAddress
  ): OperationRequestBuilder {
    const payment: ConfidentialPayment = {
      value: amountUnits,
      receiver,
    };

    const [joinSplits, payments] = this.joinSplitsAndPaymentsByAsset.get(
      asset
    ) ?? [[], []];
    payments.push(payment);
    this.joinSplitsAndPaymentsByAsset.set(asset, [joinSplits, payments]);

    return this;
  }

  // indicates that the operation expects a refund of asset `Asset`.
  refundAsset(asset: Asset): OperationRequestBuilder {
    this.op.refundAssets.push(asset);
    return this;
  }

  // Set the stealth address `refundAddr` up-front.
  // if this is not set, the wallet will generate a new one
  // returns `this` so it's chainable
  refundAddr(addr: StealthAddress): OperationRequestBuilder {
    this.op.refundAddr = addr;
    return this;
  }

  // Attach chainId to operation
  chainId(chainId: bigint): OperationRequestBuilder {
    this.op.chainId = chainId;
    return this;
  }

  // Attach chainId to operation
  deadline(deadline: bigint): OperationRequestBuilder {
    this.op.deadline = deadline;
    return this;
  }

  // Specify the maximum number of refunds possible for the operation.
  // if this is not set, the SDK will estimate it very naively.
  // if you can predict this up-front, setting it may save gas.
  // returns `this` so it's chainable
  maxNumRefunds(maxNumRefunds: bigint): OperationRequestBuilder {
    this.op.maxNumRefunds = maxNumRefunds;
    return this;
  }

  // Specify gas parameters up-front.
  // this is optional and not recommended.
  // usually you want to just let the wallet estimate this instead.
  // returns `this` so it's chainable
  gas(gasParams: OperationGasParams): OperationRequestBuilder {
    const { executionGasLimit, gasPrice } = gasParams;
    this.op.executionGasLimit = executionGasLimit;
    this.op.gasPrice = gasPrice;
    return this;
  }

  gasPrice(gasPrice: bigint): OperationRequestBuilder {
    this.op.gasPrice = gasPrice;
    return this;
  }

  // builds the `OperationRequest`.
  // unwraps become `joinSplitRequest`s.
  // all `confidentialPayment`s and joinSplits for the same asset are consolidated
  // if `refundAddr` was not called, the refund address will not be set.
  // In the output, unwraps, actions, and refunds are guaranteed
  // to appear in the order their corresponding methods were invoked
  build(): OperationRequest {
    const joinSplitRequests = [];

    // consolidate joinSplits and payments for each asset
    for (const [
      asset,
      [joinSplits, payments],
    ] of this.joinSplitsAndPaymentsByAsset.entries()) {
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

    this.op.joinSplitRequests = joinSplitRequests;
    return this.op;
  }
}
