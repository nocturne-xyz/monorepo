import _ from "lodash";
import { Action } from "../contract";
import { CanonAddress, StealthAddress } from "../crypto";
import { Asset } from "./asset";

export interface ConfidentialPayment {
  value: bigint;
  receiver: CanonAddress;
}

// A joinsplit request is an unwrapRequest plus an optional payment
export interface JoinSplitRequest {
  asset: Asset;
  unwrapValue: bigint;
  payment?: ConfidentialPayment;
}

export interface OperationRequest {
  joinSplitRequests: JoinSplitRequest[];
  refundAddr?: StealthAddress;
  refundAssets: Asset[];
  actions: Action[];
  verificationGasLimit?: bigint;
  executionGasLimit?: bigint;
  gasPrice?: bigint;
  maxNumRefunds?: bigint;
}

type JoinSplitsAndPaymentsForAsset = [JoinSplitRequest[], ConfidentialPayment[]];

export class NocturneOpRequestBuilder {
  private op: OperationRequest
  private joinSplitsAndPaymentsByAsset: Map<Asset, JoinSplitsAndPaymentsForAsset>

  // constructor takes no parameters. `new NocturneOperationBuilder()`
	constructor() {
    this.op = {
      joinSplitRequests: [],
      refundAssets: [],
      actions: []
    }

    this.joinSplitsAndPaymentsByAsset = new Map()
  }

	// add an action `action` to the operation
  // returns `this` so it's chainable
	action(action: Action): NocturneOpRequestBuilder {
    this.op.actions.push(action)
    return this
  }

	// specify the operation should unwrap `amountUnits` of `asset`
	// `ammountUnits` is the amount in EVM (uint256) representation. It is up to
	// the caller to handle decimal conversions
	// returns `this` so it's chainable
	unwrap(asset: Asset, amountUnits: bigint): NocturneOpRequestBuilder {
    const joinSplit: JoinSplitRequest = {
      asset,
      unwrapValue: amountUnits
    }

    const [joinSplits, payments] = this.joinSplitsAndPaymentsByAsset.get(asset) ?? [[], []]
    joinSplits.push(joinSplit);
    this.joinSplitsAndPaymentsByAsset.set(asset, [joinSplits, payments]);

    return this
  }

  confidentialPayment(asset: Asset, amountUnits: bigint, receiver: CanonAddress): NocturneOpRequestBuilder {
    const payment: ConfidentialPayment = {
      value: amountUnits,
      receiver
    }

    const [joinSplits, payments] = this.joinSplitsAndPaymentsByAsset.get(asset) ?? [[], []]
    payments.push(payment);
    this.joinSplitsAndPaymentsByAsset.set(asset, [joinSplits, payments]);

    return this
  }

	// indicates that the operation expects a refund of asset `Asset`.
	refundAsset(asset: Asset): NocturneOpRequestBuilder {
    this.op.refundAssets.push(asset)
    return this
  }

  // Set the stealth address `refundAddr` up-front. 
	// if this is not set, the wallet will generate a new one
	// returns `this` so it's chainable
	refundAddr(addr: StealthAddress): NocturneOpRequestBuilder {
    this.op.refundAddr = addr
    return this
  }

	// Specify the maximum number of refunds possible for the operation.
	// if this is not set, the SDK will estimate it very naively.
	// if you can predict this up-front, setting it may save gas.
	// returns `this` so it's chainable
	maxNumRefunds(maxNumRefunds: bigint): NocturneOpRequestBuilder {
    this.op.maxNumRefunds = maxNumRefunds
    return this
  }

  // Specify gas parameters up-front.
  // this is optional and not recommended.
	// usually you want to just let the wallet estimate this instead.
	// returns `this` so it's chainable
  gas(verificationGas: bigint, executionGas: bigint, gasPrice: bigint): NocturneOpRequestBuilder {
    this.op.verificationGasLimit = verificationGas
    this.op.executionGasLimit = executionGas
    this.op.gasPrice = gasPrice
    return this
  }

  // builds the `OperationRequest`.
	// unwraps become `joinSplitRequest`s.
  // all `confidentialPayment`s and joinSplits for the same asset are consolidated
  // if `refundAddr` was not called, the refund address will not be set.
	// In the output, unwraps, actions, and refunds are guaranteed
	// to appear in the order their corresponding methods were invoked
	build(): OperationRequest {
    const joinSplitRequests = []

    // consolidate joinSplits and payments for each asset
    for (const [asset, [joinSplits, payments]] of this.joinSplitsAndPaymentsByAsset.entries()) {
      // consolidate payments to the same receiver
      const paymentsByReceiver = _.groupBy(payments, (p) => p.receiver.toString());
      const consolidatedPayments = _.flatMap(paymentsByReceiver, (payments) => {
        if (payments.length === 0) {
          return []
        }
        const value = payments.reduce((acc, payment) => acc + payment.value, 0n);
        const receiver = payments[0].receiver;
        return [{ value, receiver }]
      })

      // assign each payment to a joinsplit. If there are not enough joinsplits, then create new ones
      for (const payment of consolidatedPayments) {
        const joinSplit = joinSplits.pop()
        if (joinSplit) {
          joinSplit.payment = payment
          joinSplitRequests.push(joinSplit)
        } else {
          joinSplitRequests.push({
            asset,
            unwrapValue: 0n,
            payment
          })
        }
      }

      // consolidate any remaining unassigned joinsplits
      if (joinSplits.length > 0) {
        const value = joinSplits.reduce((acc, joinSplit) => acc + joinSplit.unwrapValue, 0n);
        joinSplitRequests.push({
          asset,
          unwrapValue: value
        })
      }
    }

    this.op.joinSplitRequests = joinSplitRequests
    return this.op
  }
}
