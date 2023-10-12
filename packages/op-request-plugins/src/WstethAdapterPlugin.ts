import { Action, AssetTrait } from "@nocturne-xyz/core";
import {
  BaseOpRequestBuilder,
  OpRequestBuilderExt,
  OpRequestBuilderPlugin,
  OperationMetadataItem,
  BuilderItemToProcess,
  UnwrapRequest,
  RefundRequest,
} from "@nocturne-xyz/client";
import { WstethAdapter__factory } from "@nocturne-xyz/contracts";
import ERC20_ABI from "./abis/ERC20.json";
import { ethers } from "ethers";

const WETH_NAME = "WETH";
const WSTETH_NAME = "wstETH";
const WSTETH_ADAPTER_NAME = "wstETHAdapter";

export interface WstethAdapterPluginMethods {
  // adds an ERC20 transfer to the operation
  // handles encoding, unwrapping, and metadata
  depositWethForWsteth(amount: bigint): this;
}

export type WstethAdapterPluginExt<T extends BaseOpRequestBuilder> = T &
  WstethAdapterPluginMethods;

export function WstethAdapterPlugin<EInner extends BaseOpRequestBuilder>(
  inner: OpRequestBuilderExt<EInner>
): OpRequestBuilderExt<WstethAdapterPluginExt<EInner>> {
  type E = WstethAdapterPluginExt<EInner>;

  function use<E2 extends E>(
    this: OpRequestBuilderExt<E>,
    plugin: OpRequestBuilderPlugin<E, E2>
  ): OpRequestBuilderExt<E2> {
    return plugin(this);
  }

  return {
    ...inner,
    use: use,
    depositWethForWsteth(amount: bigint) {
      const prom = new Promise<BuilderItemToProcess>((resolve) => {
        const wstethAdapterAddress =
          this.config.protocolAllowlist.get(WSTETH_ADAPTER_NAME)?.address;
        if (!wstethAdapterAddress) {
          throw new Error(
            `WstethAdapter not supported on chain with id: ${this._op.chainId}`
          );
        }

        const wethAddress = this.config.erc20s.get(WETH_NAME)?.address;
        if (!wethAddress) {
          throw new Error(
            `Weth not supported on chain with id: ${this._op.chainId}`
          );
        }

        const wstethAddress = this.config.erc20s.get(WSTETH_NAME)?.address;
        if (!wstethAddress) {
          throw new Error(
            `Wsteth not supported on chain with id: ${this._op.chainId}`
          );
        }

        const wethInterface = new ethers.utils.Interface(ERC20_ABI);
        const wethAsset = AssetTrait.erc20AddressToAsset(wethAddress);
        const wstethAsset = AssetTrait.erc20AddressToAsset(wstethAddress);

        const unwrap: UnwrapRequest = {
          asset: wethAsset,
          unwrapValue: amount,
        };

        const approveAction: Action = {
          contractAddress: wethAddress,
          encodedFunction: wethInterface.encodeFunctionData("approve", [
            wstethAdapterAddress,
            amount,
          ]),
        };

        const depositAction: Action = {
          contractAddress: wstethAdapterAddress,
          encodedFunction:
            WstethAdapter__factory.createInterface().encodeFunctionData(
              "deposit",
              [amount]
            ),
        };

        const refund: RefundRequest = {
          asset: wstethAsset,
          minRefundValue: amount, // TODO: should there be some buffer for some kind of slippage?
        };

        const metadata: OperationMetadataItem = {
          type: "Action",
          actionType: "Weth To Wsteth",
          amount,
        };

        resolve({
          unwraps: [unwrap],
          confidentialPayments: [],
          actions: [approveAction, depositAction],
          refunds: [refund],
          metadatas: [metadata],
        });
      });

      this.pluginFn(prom);

      return this;
    },
  };
}
