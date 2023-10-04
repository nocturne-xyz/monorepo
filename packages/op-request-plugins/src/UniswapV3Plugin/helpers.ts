import { Address } from "@nocturne-xyz/core";
import {
  ChainId,
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

export interface GetSwapRouteParams {
  chainId: bigint;
  baseProvider: ethers.providers.BaseProvider;
  fromAddress: Address;
  tokenInAddress: Address;
  amountIn: bigint;
  tokenOutAddress: Address;
  maxSlippageBps: number;
}

export async function getSwapRoute({
  chainId,
  baseProvider: provider,
  fromAddress,
  tokenInAddress,
  amountIn,
  tokenOutAddress,
  maxSlippageBps,
}: GetSwapRouteParams): Promise<SwapRoute | null> {
  const uniswapChainId = chainIdToUniswapChainIdType(chainId);
  const swapRouter = new AlphaRouter({
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
    tokenInAddress,
    await erc20OutContract.decimals(),
    await erc20OutContract.symbol(),
    await erc20OutContract.name()
  );

  const swapOpts: SwapOptionsSwapRouter02 = {
    type: SwapType.SWAP_ROUTER_02,
    recipient: fromAddress,
    slippageTolerance: new Percent(maxSlippageBps, 100),
    deadline: Date.now() + 3_600,
  };
  const route = await swapRouter.route(
    CurrencyAmount.fromRawAmount(tokenIn, amountIn.toString()),
    tokenOut,
    TradeType.EXACT_INPUT,
    swapOpts
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
