import { ethers } from "ethers";
import {
  Action,
  Address,
  AssetTrait,
  BaseOpRequestBuilder,
  OpRequestBuilderExt,
  OpRequestBuilderPlugin,
  OperationMetadataItem,
  BuilderItemToProcess,
  UnwrapRequest,
} from "@nocturne-xyz/core";
import ERC20_ABI from "./abis/ERC20.json";

export interface Erc20PluginMethods {
  // adds an ERC20 transfer to the operation
  // handles encoding, unwrapping, and metadata
  erc20Transfer(
    contractAddress: Address,
    recipient: Address,
    amount: bigint
  ): this;
}

export type Erc20PluginExt<T extends BaseOpRequestBuilder> = T &
  Erc20PluginMethods;

export function Erc20Plugin<EInner extends BaseOpRequestBuilder>(
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
    erc20Transfer(
      tokenContractAddress: Address,
      recipient: Address,
      amount: bigint
    ) {
      const prom = new Promise<BuilderItemToProcess>((resolve) => {
        const encodedErc20 =
          AssetTrait.erc20AddressToAsset(tokenContractAddress);

        const contract = new ethers.Contract(tokenContractAddress, ERC20_ABI);
        const encodedFunction = contract.interface.encodeFunctionData(
          "transfer",
          [recipient, amount]
        );

        const unwrap: UnwrapRequest = {
          asset: encodedErc20,
          unwrapValue: amount,
        };

        const action: Action = {
          contractAddress: tokenContractAddress,
          encodedFunction,
        };

        const metadata: OperationMetadataItem = {
          type: "Action",
          actionType: "Transfer",
          recipientAddress: recipient,
          erc20Address: tokenContractAddress,
          amount,
        };

        resolve({
          unwraps: [unwrap],
          confidentialPayments: [],
          actions: [action],
          refundAssets: [],
          metadatas: [metadata],
        });
      });

      this.pluginFn(prom);

      return this;
    },
  };
}
