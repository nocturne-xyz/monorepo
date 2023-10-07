import { Address } from "@nocturne-xyz/core";
import {
  ChainId,
  Currency,
  CurrencyAmount,
  Percent,
  Token,
  TradeType,
} from "@uniswap/sdk-core";
import {
  AlphaRouter,
  SwapOptionsSwapRouter02,
  SwapRoute,
  SwapType,
} from "@uniswap/smart-order-router";
import { ethers } from "ethers";
import ERC20_ABI from "../abis/ERC20.json";
import { UniswapProtocol } from "./types";
import { Protocol } from "@uniswap/router-sdk";

export type GetSwapRouteParams = {
  chainId: bigint;
  provider: ethers.providers.JsonRpcProvider;
  fromAddress: Address;
  tokenInAddress: Address;
  amountIn: bigint;
  tokenOutAddress: Address;
  maxSlippageBps: number;
  router?: AlphaRouter;

  protocols?: UniswapProtocol[];
};

export async function getSwapRoute({
  chainId,
  provider,
  fromAddress,
  tokenInAddress,
  amountIn,
  tokenOutAddress,
  maxSlippageBps,
  router,
  protocols = ["V3"],
}: GetSwapRouteParams): Promise<SwapRoute | null> {
  const uniswapChainId = chainIdToUniswapChainIdType(chainId);
  const swapRouter =
    router ??
    new AlphaRouter({
      chainId: uniswapChainId,
      provider,
    });
  const erc20InContract = new ethers.Contract(
    tokenInAddress,
    ERC20_ABI,
    provider
  );
  const tokenIn = new Token(
    uniswapChainId,
    tokenInAddress,
    await erc20InContract.decimals(),
    await erc20InContract.symbol(),
    await erc20InContract.name()
  );
  const erc20OutContract = new ethers.Contract(
    tokenOutAddress,
    ERC20_ABI,
    provider
  );
  const tokenOut = new Token(
    uniswapChainId,
    tokenOutAddress,
    await erc20OutContract.decimals(),
    await erc20OutContract.symbol(),
    await erc20OutContract.name()
  );
  const swapOpts: SwapOptionsSwapRouter02 = {
    type: SwapType.SWAP_ROUTER_02,
    recipient: fromAddress,
    slippageTolerance: new Percent(maxSlippageBps, 10_000),
    deadline: Date.now() + 3_600,
  };
  const route = await swapRouter.route(
    CurrencyAmount.fromRawAmount(tokenIn, amountIn.toString()),
    tokenOut,
    TradeType.EXACT_INPUT,
    swapOpts,
    {
      protocols: protocols?.map((p) => Protocol[p]) ?? [],
    }
  );
  return route;
}

export function chainIdToUniswapChainIdType(chainId: bigint): ChainId {
  switch (chainId) {
    case 1n:
      return ChainId.MAINNET;
    case 5n:
      return ChainId.GOERLI;
    case 11155111n:
      return ChainId.SEPOLIA;
    default:
      throw new Error(`chainId not supported: ${chainId}`);
  }
}

export interface AnonErc20SwapQuote {
  exactQuoteWei: bigint;
  minimumAmountOutWei: bigint;
  priceImpactBps: number;
}

export async function getSwapQuote(
  params: GetSwapRouteParams
): Promise<AnonErc20SwapQuote | null> {
  const route = await getSwapRoute(params);
  if (!route) {
    return null;
  }
  const erc20OutContract = new ethers.Contract(
    params.tokenOutAddress,
    ERC20_ABI,
    params.provider
  );
  return {
    exactQuoteWei: BigInt(
      Number(route.quote.toExact()) *
        Math.pow(10, await erc20OutContract.decimals())
    ),
    minimumAmountOutWei: BigInt(
      Number(route.trade.minimumAmountOut(new Percent(50, 10_000)).toExact()) *
        Math.pow(10, await erc20OutContract.decimals())
    ),
    priceImpactBps: Number(route.trade.priceImpact.toSignificant(4)),
  };
}

export function currencyAmountToBigInt<T extends Currency>(
  currencyAmount: CurrencyAmount<T>
): bigint {
  return BigInt(currencyAmount.numerator.toString());
}
