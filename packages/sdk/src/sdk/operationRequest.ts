import _ from "lodash";
import { Action } from "../contract";
import { CanonAddress, StealthAddress } from "../crypto";
import { Asset, AssetTrait } from "./asset";

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
  maxNumRefunds?: bigint;
  gasPrice?: bigint;
}

interface ConfidentialPaymentWithAsset {
  asset: Asset;
  payment: ConfidentialPayment;
}

export class NocturneOpRequestBuilder {
  private op: OperationRequest
  private joinSplitRequests: JoinSplitRequest[]
  private confidentialPayments: ConfidentialPaymentWithAsset[]

  // constructor takes no parameters. `new NocturneOperationBuilder()`
	constructor() {
    this.op = {
      joinSplitRequests: [],
      refundAssets: [],
      actions: []
    }

    this.joinSplitRequests = []
    this.confidentialPayments = []
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
    this.joinSplitRequests.push({
      asset,
      unwrapValue: amountUnits
    });
    return this
  }

  confidentialPayment(asset: Asset, amountUnits: bigint, receiver: CanonAddress): NocturneOpRequestBuilder {
    const payment: ConfidentialPayment = {
      value: amountUnits,
      receiver
    }

    this.confidentialPayments.push({
      asset,
      payment
    });
    return this
  }

	// indicates that the operation expects a refund of asset `Asset`.
	refund(asset: Asset): NocturneOpRequestBuilder {
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
  // If `consolidateJoinSplits` is set to `true`,
  // joinsplit requests will be consolidated when possible.
  // If `consolidateConfidentialPayments` is set to `true`,
  // confidential payments will be consolidated when possible.
  // if `refundAddr` was not called, the refund address will not be set.
	// In the output, unwraps, actions, and refunds are guaranteed
	// to appear in the order their corresponding methods were invoked
	build(): OperationRequest {
    // TODO
  }
}
