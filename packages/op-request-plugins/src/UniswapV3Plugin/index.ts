import {
  Action,
  Address,
  AssetTrait,
  BaseOpRequestBuilder,
  BuilderItemToProcess,
  OpRequestBuilderExt,
  OpRequestBuilderPlugin,
  OperationMetadataItem,
  RefundRequest,
  UnwrapRequest,
} from "@nocturne-xyz/core";
import { ethers } from "ethers";
import JSBI from "jsbi";
import ERC20_ABI from "../abis/ERC20.json";
import { getSwapRoute } from "./helpers";

const UNISWAP_V3_NAME = "uniswapV3";

export interface UniswapV3PluginMethods {
  swap(
    tokenIn: Address,
    inAmount: bigint,
    tokenOut: Address,
    maxSlippageBps?: number
  ): this;
}

export type UniswapV3PluginExt<T extends BaseOpRequestBuilder> = T &
  UniswapV3PluginMethods;

export function UniswapV3Plugin<EInner extends BaseOpRequestBuilder>(
  inner: OpRequestBuilderExt<EInner>
): OpRequestBuilderExt<UniswapV3PluginExt<EInner>> {
  type E = UniswapV3PluginExt<EInner>;

  function use<E2 extends E>(
    this: OpRequestBuilderExt<E>,
    plugin: OpRequestBuilderPlugin<E, E2>
  ): OpRequestBuilderExt<E2> {
    return plugin(this);
  }

  return {
    ...inner,
    use: use,

    swap(
      tokenIn: Address,
      inAmount: bigint,
      tokenOut: Address,
      maxSlippageBps = 50
    ) {
      const prom = new Promise<BuilderItemToProcess>(
        async (resolve, reject) => {
          try {
            const swapRouterAddress =
              this.config.protocolAllowlist.get(UNISWAP_V3_NAME)?.address;
            if (!swapRouterAddress) {
              throw new Error(
                `UniswapV3 not supported on chain with id: ${this._op.chainId}`
              );
            }
            const route = await getSwapRoute({
              chainId: this._op.chainId,
              provider: this.provider,
              fromAddress: this.config.handlerAddress,
              tokenInAddress: tokenIn,
              amountIn: inAmount,
              tokenOutAddress: tokenOut,
              maxSlippageBps,
            });
            if (!route) {
              throw new Error(
                `No route found for swap. Token in: ${tokenIn}, Token out: ${tokenOut}. Amount in: ${inAmount}`
              );
            }

            const unwrap: UnwrapRequest = {
              asset: AssetTrait.erc20AddressToAsset(tokenIn),
              unwrapValue: inAmount,
            };

            const swapAction: Action = {
              contractAddress: swapRouterAddress,
              encodedFunction: route.methodParameters!.calldata,
            };

            const refund: RefundRequest = {
              asset: AssetTrait.erc20AddressToAsset(tokenOut),
              minRefundValue: BigInt(
                JSBI.divide(
                  route.quote.numerator,
                  route.quote.denominator
                ).toString()
              ), // TODO: this may not be forgiving accounting for slippage, may cause swap reverts
            };

            const metadata: OperationMetadataItem = {
              type: "Action",
              actionType: "UniswapV3 Swap",
              tokenIn,
              inAmount,
              tokenOut,
            };
            const erc20InContract = new ethers.Contract(
              tokenIn,
              ERC20_ABI,
              this.provider
            );
            // If router contract doesn't have high enough allowance, set to max for handler ->
            // router. Anyone can set allowance on handler so might as well set to max.
            if (
              (
                await erc20InContract.allowance(
                  this.config.handlerAddress,
                  swapRouterAddress
                )
              ).toBigInt() < inAmount
            ) {
              const approveAction: Action = {
                contractAddress: tokenIn,
                encodedFunction: erc20InContract.interface.encodeFunctionData(
                  "approve",
                  [swapRouterAddress, inAmount]
                ),
              };

              resolve({
                unwraps: [unwrap],
                confidentialPayments: [],
                actions: [approveAction, swapAction], // enqueue approve + swap
                refunds: [refund],
                metadatas: [metadata],
              });
            } else {
              resolve({
                unwraps: [unwrap],
                confidentialPayments: [],
                actions: [swapAction],
                refunds: [refund],
                metadatas: [metadata],
              });
            }
          } catch (e) {
            reject(e);
          }
        }
      );

      this.pluginFn(prom);

      return this;
    },
  };
}

export {
  getSwapRoute,
  getSwapQuote,
  GetSwapRouteParams,
  AnonErc20SwapQuote,
} from "./helpers";
