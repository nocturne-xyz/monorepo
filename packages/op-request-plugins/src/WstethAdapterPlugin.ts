import {
  Address,
  AssetTrait,
  BaseOpRequestBuilder,
  OpRequestBuilderExt,
  OpRequestBuilderPlugin,
} from "@nocturne-xyz/core";
import { WstethAdapter__factory } from "@nocturne-xyz/contracts";

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
      const chainId = this._op.chainId;

      let wethAddress: Address;
      let wstethAdapterAddress: Address;
      let wstethAddress: Address;
      if (chainId === 1n) {
        // mainnet
        wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
        wstethAdapterAddress = "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0"; // TODO: fill with real address
        wstethAddress = "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0";
      } else {
        throw new Error(`wsteth not supported on chain with id: ${chainId}`);
      }

      const encodedWeth = AssetTrait.erc20AddressToAsset(wethAddress);
      const encodedWsteth = AssetTrait.erc20AddressToAsset(wstethAddress);

      const encodedFunction =
        WstethAdapter__factory.createInterface().encodeFunctionData("convert", [
          amount,
        ]);

      this.unwrap(encodedWeth, amount).action(
        wstethAdapterAddress,
        encodedFunction
      );

      this._metadata.items.push({
        type: "Action",
        actionType: "Weth To Wsteth",
        amount,
      });

      this.refundAsset(encodedWsteth);

      return this;
    },
  };
}
