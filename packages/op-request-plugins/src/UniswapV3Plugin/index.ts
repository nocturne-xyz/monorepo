import {
  BaseOpRequestBuilder,
  BuilderItemToProcess,
  OpRequestBuilderExt,
  OpRequestBuilderPlugin,
  OperationMetadataItem,
  RefundRequest,
  UnwrapRequest,
} from "@nocturne-xyz/client";
import { UniswapV3Adapter__factory } from "@nocturne-xyz/contracts";
import { Action, Address, AssetTrait } from "@nocturne-xyz/core";
import * as JSON from "bigint-json-serialization";
import { ethers } from "ethers";
import ERC20_ABI from "../abis/ERC20.json";
import {
  bpsToPercent,
  currencyAmountToBigInt,
  formatSwapQuote,
  getSwapRoute,
} from "./helpers";
import { ExactInputParams, ExactInputSingleParams } from "./types";

const UNISWAP_V3_ADAPTER_NAME = "UniswapV3Adapter";

export interface UniswapV3SwapOptions {
  maxSlippageBps?: number;
  recipient?: Address;
}

export interface UniswapV3PluginMethods {
  swap(
    tokenIn: Address,
    inAmount: bigint,
    tokenOut: Address,
    opts?: UniswapV3SwapOptions
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
      opts?: UniswapV3SwapOptions
    ) {
      const prom = new Promise<BuilderItemToProcess>(
        async (resolve, reject) => {
          try {
            const uniswapV3Adapter = this.config.protocolAllowlist.get(
              UNISWAP_V3_ADAPTER_NAME
            )?.address;
            if (!uniswapV3Adapter) {
              throw new Error(
                `UniswapV3Adapter not supported on chain with id: ${this._op.chainId}`
              );
            }

            const maxSlippageBps = opts?.maxSlippageBps ?? 100;
            const swapRoute = await getSwapRoute({
              chainId: this._op.chainId,
              provider: this.provider,
              fromAddress: this.config.handlerAddress,
              tokenInAddress: tokenIn,
              amountIn: inAmount,
              tokenOutAddress: tokenOut,
              maxSlippageBps,
            });

            console.log("swapRoute", JSON.stringify(swapRoute));

            if (!swapRoute) {
              throw new Error(
                `No route found for swap. Token in: ${tokenIn}, Token out: ${tokenOut}. Amount in: ${inAmount}`
              );
            }
            if (swapRoute.route[0].protocol !== "V3") {
              throw new Error("Only supporting uniswap v3");
            }

            const route = swapRoute.route[0];
            const pools = route.route.pools;
            const minimumAmountWithSlippage = currencyAmountToBigInt(
              swapRoute.trade.minimumAmountOut(bpsToPercent(maxSlippageBps))
            );

            const recipient = opts?.recipient ?? this.config.handlerAddress;

            let swapParams: ExactInputSingleParams | ExactInputParams;
            let encodedFunction: string;
            if (pools.length == 1) {
              const pool = pools[0];
              swapParams = {
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: pool.fee,
                recipient,
                deadline: Date.now() + 3_600,
                amountIn: inAmount,
                amountOutMinimum: minimumAmountWithSlippage,
                sqrtPriceLimitX96: 0,
              };

              encodedFunction =
                UniswapV3Adapter__factory.createInterface().encodeFunctionData(
                  "exactInputSingle",
                  [swapParams]
                );
            } else {
              // NOTE: v3 swap route for A->D with structure (token0, token1) will be
              // (B, A), (C, B), (D, C)
              swapParams = {
                path: "0x",
                recipient,
                deadline: Date.now() + 3_600,
                amountIn: inAmount,
                amountOutMinimum: minimumAmountWithSlippage,
              };
              for (let i = 0; i < pools.length; i++) {
                const pool = pools[i];
                if (i == 0) {
                  console.log(
                    `address1: ${pool.token1.address} \n fee: ${pool.fee} \n address2: ${pool.token0.address}`
                  );
                  const component = ethers.utils
                    .solidityPack(
                      ["address", "uint24", "address"],
                      [pool.token1.address, pool.fee, pool.token0.address]
                    )
                    .slice(2);
                  swapParams.path += component;
                } else {
                  console.log(
                    `fee: ${pool.fee} \n address2: ${pool.token0.address}`
                  );
                  const component = ethers.utils
                    .solidityPack(
                      ["uint24", "address"],
                      [pool.fee, pool.token0.address]
                    )
                    .slice(2);
                  swapParams.path += component;
                }
              }

              console.log("swapParams:", JSON.stringify(swapParams));

              encodedFunction =
                UniswapV3Adapter__factory.createInterface().encodeFunctionData(
                  "exactInput",
                  [swapParams]
                );
            }

            const unwrap: UnwrapRequest = {
              asset: AssetTrait.erc20AddressToAsset(tokenIn),
              unwrapValue: inAmount,
            };

            const swapAction: Action = {
              contractAddress: uniswapV3Adapter,
              encodedFunction: encodedFunction,
            };

            const refund: RefundRequest = {
              asset: AssetTrait.erc20AddressToAsset(tokenOut),
              minRefundValue: minimumAmountWithSlippage,
            };

            const quote = formatSwapQuote(swapRoute, maxSlippageBps);

            const metadata: OperationMetadataItem = {
              type: "Action",
              actionType: "UniswapV3 Swap",
              tokenIn,
              inAmount,
              tokenOut,
              maxSlippageBps,
              exactQuoteWei: quote.exactQuoteWei,
              minimumAmountOutWei: quote.minimumAmountOutWei,
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
                  uniswapV3Adapter
                )
              ).toBigInt() < inAmount
            ) {
              const approveAction: Action = {
                contractAddress: tokenIn,
                encodedFunction: erc20InContract.interface.encodeFunctionData(
                  "approve",
                  [uniswapV3Adapter, inAmount]
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

export * from "./helpers";
