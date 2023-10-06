import { ethers } from "ethers";
import { Action, Address, AssetTrait } from "@nocturne-xyz/core";
import {
  BaseOpRequestBuilder,
  OpRequestBuilderExt,
  OpRequestBuilderPlugin,
  ActionMetadata,
  BuilderItemToProcess,
  UnwrapRequest,
} from "@nocturne-xyz/client";
import ERC20_ABI from "./abis/ERC20.json";
import { findInfoByAddressFromConfig, Erc20TokenInfo } from "./utils";

export interface Erc20PluginMethods {
  // adds an ERC20 transfer to the operation
  // handles encoding, unwrapping, and metadata
  erc20Transfer(
    contractAddress: Address,
    recipient: Address,
    amount: bigint,
    // optional token info to use for formatting metadata
    tokenInfo?: Erc20TokenInfo
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
      amount: bigint,
      // optional token info to use for formatting metadata
      // TODO store JSON with infos for common tokens and use that so this is only necessary for "long-tail" tokens
      tokenInfo?: Erc20TokenInfo
    ) {
      const prom = new Promise<BuilderItemToProcess>((resolve) => {
        const encodedErc20 =
          AssetTrait.erc20AddressToAsset(tokenContractAddress);

        const contract = new ethers.Contract(
          tokenContractAddress,
          ERC20_ABI,
          this.provider
        );
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

        const displayTokenInfo =
          tokenInfo ??
          findInfoByAddressFromConfig(this.config, tokenContractAddress);
        const displayTokenName =
          displayTokenInfo?.symbol ?? tokenContractAddress;
        const displayAmount = tokenInfo
          ? ethers.utils.formatUnits(amount, tokenInfo.decimals)
          : amount.toString();

        const metadata: ActionMetadata = {
          summary: `Transfer ${displayAmount} ${displayTokenName} to ${recipient}`,
          pluginInfo: {
            name: "Erc20Plugin",
            source: "@nocturne-xyz/op-request-plugins",
          },
          details: {
            tokenContractAddress: tokenContractAddress,
            recipientAddress: recipient,
            amount: amount.toString(),
            ...(tokenInfo
              ? {
                  symbol: tokenInfo.symbol,
                  decimals: tokenInfo.decimals.toString(),
                }
              : {}),
          },
        };

        resolve({
          unwraps: [unwrap],
          confidentialPayments: [],
          actions: [action],
          refunds: [],
          metadatas: [metadata],
        });
      });

      this.pluginFn(prom);

      return this;
    },
  };
}
