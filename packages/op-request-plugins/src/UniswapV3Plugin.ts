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
import { ChainId, Percent, Token, TradeType } from "@uniswap/sdk-core";
import {
  AlphaRouter,
  CurrencyAmount,
  SwapOptionsUniversalRouter,
  SwapType,
} from "@uniswap/smart-order-router";
import { ethers } from "ethers";
import ERC20_ABI from "./abis/ERC20.json";

const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const UNIVERSAL_SWAP_ROUTER_ADDRESS =
  "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD";

export interface UniswapV3PluginMethods {
  getSwapRouter(): AlphaRouter;

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

    getSwapRouter(): AlphaRouter {
      const chainId = chainIdToUniswapChainIdType(this._op.chainId);
      const baseProvider = new ethers.providers.BaseProvider(
        this.provider.getNetwork()
      );
      return new AlphaRouter({
        provider: baseProvider,
        chainId,
      });
    },

    swap(
      tokenIn: Address,
      inAmount: bigint,
      tokenOut: Address,
      maxSlippageBps?: number
    ) {
      const prom = new Promise<BuilderItemToProcess>(
        async (resolve, reject) => {
          try {
            const router = this.getSwapRouter();
            const handlerAddress = this.config.handlerAddress();

            const erc20InContract = new ethers.Contract(tokenIn, ERC20_ABI);
            const tokenInDecimals = Number(await erc20InContract.decimals());
            const tokenInSymbol: string = await erc20InContract.symbol();
            const tokenInName: string = await erc20InContract.name();

            const erc20OutContract = new ethers.Contract(tokenOut, ERC20_ABI);
            const tokenOutDecimals = Number(await erc20OutContract.decimals());
            const tokenOutSymbol: string = await erc20OutContract.symbol();
            const tokenOutName: string = await erc20OutContract.name();

            const swapOpts: SwapOptionsUniversalRouter = {
              type: SwapType.UNIVERSAL_ROUTER,
              simulate: {
                fromAddress: handlerAddress,
              },
              slippageTolerance: new Percent(maxSlippageBps ?? 50, 10_000),
              recipient: handlerAddress,
              deadlineOrPreviousBlockhash: Date.now() + 3_600,
            };
            const chainId = chainIdToUniswapChainIdType(this._op.chainId);
            const route = await router.route(
              CurrencyAmount.fromRawAmount(
                new Token(
                  chainId,
                  tokenIn,
                  tokenInDecimals,
                  tokenInSymbol,
                  tokenInName
                ),
                Number(inAmount) // TODO: truncation ok?
              ),
              new Token(
                chainId,
                tokenOut,
                tokenOutDecimals,
                tokenOutSymbol,
                tokenOutName
              ),
              TradeType.EXACT_INPUT,
              swapOpts
            );

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
              contractAddress: UNIVERSAL_SWAP_ROUTER_ADDRESS,
              encodedFunction: route.methodParameters!.calldata,
            };

            const refundAsset = AssetTrait.erc20AddressToAsset(tokenOut);

            const metadata: OperationMetadataItem = {
              type: "Action",
              actionType: "UniswapV3 Swap",
              tokenIn,
              inAmount,
              tokenOut,
            };

            // If permit2 contract doesn't have high enough allowance, set to max for handler -> router
            if (
              (await erc20InContract.allowance(PERMIT2_ADDRESS)).toBigInt() <
              inAmount
            ) {
              const approveAction: Action = {
                contractAddress: tokenIn,
                encodedFunction: erc20InContract.interface.encodeFunctionData(
                  "approve",
                  [PERMIT2_ADDRESS, ethers.constants.MaxUint256]
                ),
              };

              resolve({
                unwraps: [unwrap],
                confidentialPayments: [],
                actions: [approveAction, swapAction], // enqueue approve + swap
                refundAssets: [refundAsset],
                metadatas: [metadata],
              });
            } else {
              resolve({
                unwraps: [unwrap],
                confidentialPayments: [],
                actions: [swapAction],
                refundAssets: [refundAsset],
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

function chainIdToUniswapChainIdType(chainId: bigint): ChainId {
  switch (chainId) {
    case 1n:
      return ChainId.MAINNET;
    case 11155111n:
      return ChainId.SEPOLIA;
    default:
      throw new Error(`chainId not supported: ${chainId}`);
  }
}
