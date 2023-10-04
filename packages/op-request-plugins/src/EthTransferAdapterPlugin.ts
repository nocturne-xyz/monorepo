import { Action, AssetTrait, Address } from "@nocturne-xyz/core";
import {
  BaseOpRequestBuilder,
  OpRequestBuilderExt,
  OpRequestBuilderPlugin,
  OperationMetadataItem,
  BuilderItemToProcess,
  UnwrapRequest,
} from "@nocturne-xyz/client";
import { EthTransferAdapter__factory } from "@nocturne-xyz/contracts";
import ERC20_ABI from "./abis/ERC20.json";
import { ethers } from "ethers";

const WETH_NAME = "weth";
const ETH_TRANSFER_ADAPTER_NAME = "ethTransferAdapter";

export interface EthTransferAdapterPluginMethods {
  transferEth(to: Address, value: bigint): this;
}

export type EthTransferAdapterPluginExt<T extends BaseOpRequestBuilder> = T &
  EthTransferAdapterPluginMethods;

export function EthTransferAdapterPlugin<EInner extends BaseOpRequestBuilder>(
  inner: OpRequestBuilderExt<EInner>
): OpRequestBuilderExt<EthTransferAdapterPluginExt<EInner>> {
  type E = EthTransferAdapterPluginExt<EInner>;

  function use<E2 extends E>(
    this: OpRequestBuilderExt<E>,
    plugin: OpRequestBuilderPlugin<E, E2>
  ): OpRequestBuilderExt<E2> {
    return plugin(this);
  }

  return {
    ...inner,
    use: use,
    transferEth(to: Address, value: bigint) {
      const prom = new Promise<BuilderItemToProcess>((resolve) => {
        const ethTransferAdapterAddress = this.config.protocolAllowlist.get(
          ETH_TRANSFER_ADAPTER_NAME
        )?.address;

        if (!ethTransferAdapterAddress) {
          throw new Error(
            `EthTransferAdapter not supported on chain with id: ${this._op.chainId}`
          );
        }

        const wethAddress = this.config.erc20s.get(WETH_NAME)?.address;
        if (!wethAddress) {
          throw new Error(
            `Weth not supported on chain with id: ${this._op.chainId}`
          );
        }

        const wethInterface = new ethers.utils.Interface(ERC20_ABI);
        const wethAsset = AssetTrait.erc20AddressToAsset(wethAddress);

        const unwrap: UnwrapRequest = {
          asset: wethAsset,
          unwrapValue: value,
        };

        const approveAction: Action = {
          contractAddress: wethAddress,
          encodedFunction: wethInterface.encodeFunctionData("approve", [
            ethTransferAdapterAddress,
            value,
          ]),
        };

        const transferAction: Action = {
          contractAddress: ethTransferAdapterAddress,
          encodedFunction:
            EthTransferAdapter__factory.createInterface().encodeFunctionData(
              "transfer",
              [to, value]
            ),
        };

        const metadata: OperationMetadataItem = {
          type: "Action",
          actionType: "Transfer ETH",
          to,
          value,
        };

        resolve({
          unwraps: [unwrap],
          confidentialPayments: [],
          actions: [approveAction, transferAction],
          refunds: [],
          metadatas: [metadata],
        });
      });

      this.pluginFn(prom);

      return this;
    },
  };
}
