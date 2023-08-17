import { CanonAddress, StealthAddress } from "../crypto";
import {
  Address,
  Asset,
  OperationGasParams,
  OperationMetadata,
  OperationRequest,
  OperationRequestWithMetadata,
} from "../primitives";
import {
  ConfidentialPayment,
  JoinSplitRequest,
} from "../primitives/operationRequest";

// generic type for an `OpRequestBuilder` that can be "extended" via plugins
export type OpRequestBuilderExt<E extends BaseOpRequestBuilder> = E & {
  use<E2 extends E>(
    plugin: OpRequestBuilderPlugin<E, E2>
  ): OpRequestBuilderExt<E2>;
};

// methods that are available by default on any implementor of `OpRequestBuilderExt`
export interface BaseOpRequestBuilder {
  _op: OperationRequest;
  _metadata: OperationMetadata;
  _joinSplitsAndPaymentsByAsset: Map<Asset, JoinSplitsAndPaymentsForAsset>;

  build(): OperationRequestWithMetadata;

  action(contractAddress: Address, encodedFunction: string): this;
  unwrap(asset: Asset, amountUnits: bigint): this;
  confidentialPayment(
    asset: Asset,
    amountUnits: bigint,
    receiver: CanonAddress
  ): this;
  refundAsset(asset: Asset): this;
  refundAddr(addr: StealthAddress): this;
  deadline(deadline: bigint): this;
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
