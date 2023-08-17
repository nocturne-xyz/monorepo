import { ethers } from "ethers";
import {
  BaseOpRequestBuilder,
  OpRequestBuilderExt,
  OpRequestBuilderPlugin,
} from "./types";
import { Address, AssetTrait } from "../primitives";
import ERC20_ABI from "./ERC20.json";

export interface Erc20PluginMethods {
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
      const contract = new ethers.Contract(tokenContractAddress, ERC20_ABI);
      const encodedFunction = contract.interface.encodeFunctionData(
        "transfer",
        [recipient, amount]
      );

      const encodedErc20 = AssetTrait.erc20AddressToAsset(tokenContractAddress);

      this.unwrap(encodedErc20, amount).action(
        tokenContractAddress,
        encodedFunction
      );

      this._metadata.items.push({
        type: "Action",
        actionType: "Transfer",
        recipientAddress: recipient,
        erc20Address: tokenContractAddress,
        amount,
      });

      return this;
    },
  };
}
