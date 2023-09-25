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

export async function getSwapRoute(
  swapRouter: AlphaRouter,
  chainId: bigint,
  provider: ethers.providers.BaseProvider,
  fromAddress: Address,
  tokenIn: Address,
  inAmount: bigint,
  tokenOut: Address
): Promise<SwapRoute> {
  const erc20InContract = new ethers.Contract(tokenIn, ERC20_ABI, provider);
  const tokenInDecimals = Number(await erc20InContract.decimals());
  const tokenInSymbol: string = await erc20InContract.symbol();
  const tokenInName: string = await erc20InContract.name();

  const erc20OutContract = new ethers.Contract(tokenOut, ERC20_ABI, provider);
  const tokenOutDecimals = Number(await erc20OutContract.decimals());
  const tokenOutSymbol: string = await erc20OutContract.symbol();
  const tokenOutName: string = await erc20OutContract.name();

  const swapOpts: SwapOptionsSwapRouter02 = {
    type: SwapType.SWAP_ROUTER_02,
    recipient: fromAddress,
    slippageTolerance: new Percent(100, 10_000),
    deadline: Date.now() + 3_600,
  };
  const uniswapChainId = chainIdToUniswapChainIdType(chainId);
  const route = await swapRouter.route(
    CurrencyAmount.fromRawAmount(
      new Token(
        uniswapChainId,
        tokenIn,
        tokenInDecimals,
        tokenInSymbol,
        tokenInName
      ),
      Number(inAmount) // TODO: truncation ok?
    ),
    new Token(
      uniswapChainId,
      tokenOut,
      tokenOutDecimals,
      tokenOutSymbol,
      tokenOutName
    ),
    TradeType.EXACT_INPUT,
    swapOpts
  );

  return route!;
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
