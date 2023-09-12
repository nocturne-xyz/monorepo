import {
  Action,
  Asset,
  AssetTrait,
  BaseOpRequestBuilder,
  OpRequestBuilderExt,
  OpRequestBuilderPlugin,
  OperationMetadataItem,
  BuilderItemToProcess,
  UnwrapRequest,
} from "@nocturne-xyz/core";
import { WstethAdapter__factory } from "@nocturne-xyz/contracts";

const WSTETH_ADAPTER_NAME = "wstethAdapter";

export interface WstethAdapterPluginMethods {
  // adds an ERC20 transfer to the operation
  // handles encoding, unwrapping, and metadata
  convertWethToWsteth(amount: bigint): this;
}

export type Erc20PluginExt<T extends BaseOpRequestBuilder> = T &
  WstethAdapterPluginMethods;

export function WstethAdapterPlugin<EInner extends BaseOpRequestBuilder>(
  inner: OpRequestBuilderExt<EInner>
): OpRequestBuilderExt<Erc20PluginExt<EInner>> {
  type E = Erc20PluginExt<EInner>;

  function use<E2 extends E>(
    this: OpRequestBuilderExt<E>,
    plugin: OpRequestBuilderPlugin<E, E2>
  ): OpRequestBuilderExt<E2> {
    return plugin(this);
  }

  return {
    ...inner,
    use: use,
    convertWethToWsteth(amount: bigint) {
      const prom = new Promise<BuilderItemToProcess>((resolve) => {
        const wstethAdapterAddress =
          this.config.protocolAllowlist.get(WSTETH_ADAPTER_NAME)?.address;
        if (!wstethAdapterAddress) {
          throw new Error(
            `WstethAdapter not supported on chain with id: ${this._op.chainId}`
          );
        }

        const wethAddress =
          this.config.erc20s.get(WSTETH_ADAPTER_NAME)?.address;
        if (!wethAddress) {
          throw new Error(
            `Weth not supported on chain with id: ${this._op.chainId}`
          );
        }

        const wstethAddress =
          this.config.erc20s.get(WSTETH_ADAPTER_NAME)?.address;
        if (!wstethAddress) {
          throw new Error(
            `Wsteth not supported on chain with id: ${this._op.chainId}`
          );
        }

        const encodedWeth = AssetTrait.erc20AddressToAsset(wethAddress);
        const encodedWsteth = AssetTrait.erc20AddressToAsset(wstethAddress);

        const encodedFunction =
          WstethAdapter__factory.createInterface().encodeFunctionData(
            "convert",
            [amount]
          );

        const unwrap: UnwrapRequest = {
          asset: encodedWeth,
          unwrapValue: amount,
        };

        const action: Action = {
          contractAddress: wstethAdapterAddress,
          encodedFunction,
        };

        const refundAsset: Asset = encodedWsteth;

        const metadata: OperationMetadataItem = {
          type: "Action",
          actionType: "Weth To Wsteth",
          amount,
        };

        resolve({
          unwraps: [unwrap],
          confidentialPayments: [],
          actions: [action],
          refundAssets: [refundAsset],
          metadatas: [metadata],
        });
      });

      this.pluginFn(prom);

      return this;
    },
  };
}
