import { Action, Address, AssetTrait } from "@nocturne-xyz/core";
import {
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
import { Percent } from "@uniswap/sdk-core";
import { IUniswapV3__factory } from "@nocturne-xyz/contracts";

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
            const swapRoute = await getSwapRoute({
              chainId: this._op.chainId,
              provider: this.provider,
              fromAddress: this.config.handlerAddress,
              tokenInAddress: tokenIn,
              amountIn: inAmount,
              tokenOutAddress: tokenOut,
              maxSlippageBps,
            });

            if (!swapRoute) {
              throw new Error(
                `No route found for swap. Token in: ${tokenIn}, Token out: ${tokenOut}. Amount in: ${inAmount}`
              );
            }
            if (swapRoute.route[0].protocol !== "V3") {
              throw new Error("Not supporting non-V3 routes");
            }

            const route = swapRoute.route[0];
            const pools = route.route.pools;
            const minimumAmountWithSlippage = BigInt(
              swapRoute.trade
                .minimumAmountOut(new Percent(50, 10_000))
                .toExact()
            );

            let swapParams: ExactInputSingleParams | ExactInputParams;
            if (pools.length == 1) {
              const pool = pools[0];
              swapParams = {
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: pool.fee,
                recipient: this.config.handlerAddress,
                deadline: Math.floor(Date.now() / 1000) + 60 * 20,
                amountIn: inAmount,
                amountOutMinimum: minimumAmountWithSlippage,
                sqrtPriceLimitX96: 0,
              };
            } else {
              throw new Error("TODO: not supporting multi hop");
            }

            const encodedFunction =
              IUniswapV3__factory.createInterface().encodeFunctionData(
                "exactInputSingle",
                [swapParams]
              );

            const unwrap: UnwrapRequest = {
              asset: AssetTrait.erc20AddressToAsset(tokenIn),
              unwrapValue: inAmount,
            };

            const swapAction: Action = {
              contractAddress: swapRouterAddress,
              encodedFunction: encodedFunction,
            };

            const refund: RefundRequest = {
              asset: AssetTrait.erc20AddressToAsset(tokenOut),
              minRefundValue: minimumAmountWithSlippage,
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

export * from "./helpers";
