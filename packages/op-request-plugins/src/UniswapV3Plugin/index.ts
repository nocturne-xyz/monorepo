import {
  Action,
  Address,
  AssetTrait,
  findInfoByAddressFromConfig,
  Erc20TokenInfo,
} from "@nocturne-xyz/core";
import {
  ActionMetadata,
  BaseOpRequestBuilder,
  BuilderItemToProcess,
  OpRequestBuilderExt,
  OpRequestBuilderPlugin,
  OperationMetadataItem,
  RefundRequest,
  UnwrapRequest,
} from "@nocturne-xyz/client";
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
    maxSlippageBps?: number,
    // optional token info to use for formatting metadata
    tokenInfos?: {
      tokenIn?: Erc20TokenInfo;
      tokenOut?: Erc20TokenInfo;
    }
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
      maxSlippageBps = 50,
      // TODO store JSON with infos for common tokens and use that so this is only necessary for "long-tail" tokens
      // optional token info to use for formatting metadata
      tokenInfos?: {
        tokenIn?: Erc20TokenInfo;
        tokenOut?: Erc20TokenInfo;
      }
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

            const tokenInInfo =
              tokenInfos?.tokenIn ??
              findInfoByAddressFromConfig(this.config, tokenIn);
            const tokenOutInfo =
              tokenInfos?.tokenOut ??
              findInfoByAddressFromConfig(this.config, tokenOut);

            const displayTokenInName = tokenInInfo?.symbol ?? tokenIn;
            const displayTokenOutName = tokenOutInfo?.symbol ?? tokenOut;

            const displayTokenInAmount = tokenInInfo
              ? ethers.utils.formatUnits(inAmount, tokenInInfo.decimals)
              : inAmount.toString();
            const displayEstimatedTokenOutAmount = tokenOutInfo
              ? ethers.utils.formatUnits(
                  refund.minRefundValue,
                  tokenOutInfo.decimals
                )
              : refund.minRefundValue.toString();

            const metadata: ActionMetadata = {
              summary: `Swap ${displayTokenInAmount} ${displayTokenInName} for ~${displayEstimatedTokenOutAmount} ${displayTokenOutName}}`,
              pluginInfo: {
                name: "UniswapV3Plugin",
                source: "@nocturne-xyz/op-request-plugins",
              },
              details: {
                tokenInContractAddress: tokenIn,
                tokenOutContractAddress: tokenOut,
                amountIn: inAmount.toString(),
                expectedAmountOut: refund.minRefundValue.toString(),
                maxSlippageBps: maxSlippageBps.toString(),
                swapRouterAddress: swapRouterAddress,
                // TODO: add full route
              },
            };
            const metadataItem: OperationMetadataItem = {
              type: "Action",
              metadata,
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
                metadatas: [metadataItem],
              });
            } else {
              resolve({
                unwraps: [unwrap],
                confidentialPayments: [],
                actions: [swapAction],
                refunds: [refund],
                metadatas: [metadataItem],
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

export * from "./helpers";
