import { ethers } from "ethers";
import {
  BaseOpRequestBuilder,
  OpRequestBuilderExt,
  OpRequestBuilderPlugin,
} from "../builder";
import { Address, AssetTrait } from "../../primitives";
import { WstethAdapter, WstethAdapter__factory } from "@nocturne-xyz/contracts";

export interface WstethAdapterPluginMethods {
  // adds an ERC20 transfer to the operation
  // handles encoding, unwrapping, and metadata
  convertWethToWsteth(amount: bigint): this;
}

export type Erc20PluginExt<T extends BaseOpRequestBuilder> = T &
  WstethAdapterPluginMethods;

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
    convertWethToWsteth(amount: bigint) {
      const chainId = this._op.chainId;

      let wstethAdapterAddress: Address;
      if (chainId === 1n) {
        // mainnet
        wstethAdapterAddress = "0x1234"; // TODO: fill with right address
      }

      const encodedFunctionData =
        WstethAdapter__factory.createInterface().encodeFunctionData("convert", [
          amount,
        ]);

      // const contract = new ethers.Contract(tokenContractAddress, ERC20_ABI);
      // const encodedFunction = contract.interface.encodeFunctionData(
      //   "transfer",
      //   [recipient, amount]
      // );

      // const encodedErc20 = AssetTrait.erc20AddressToAsset(tokenContractAddress);

      // this.unwrap(encodedErc20, amount).action(
      //   tokenContractAddress,
      //   encodedFunction
      // );

      // this._metadata.items.push({
      //   type: "Action",
      //   actionType: "Transfer",
      //   recipientAddress: recipient,
      //   erc20Address: tokenContractAddress,
      //   amount,
      // });

      return this;
    },
  };
}
