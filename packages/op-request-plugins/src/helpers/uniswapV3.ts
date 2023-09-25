import { NocturneConfig } from "@nocturne-xyz/config";
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
  SwapType,
} from "@uniswap/smart-order-router";
import { ethers } from "ethers";
import ERC20_ABI from "../abis/ERC20.json";

export async function getSwapQuote(
  swapRouter: AlphaRouter,
  tokenIn: Address,
  inAmount: bigint,
  tokenOut: Address,
  config: NocturneConfig
): Promise<bigint> {
  const erc20InContract = new ethers.Contract(tokenIn, ERC20_ABI);
  const tokenInDecimals = Number(await erc20InContract.decimals());
  const tokenInSymbol: string = await erc20InContract.symbol();
  const tokenInName: string = await erc20InContract.name();

  const erc20OutContract = new ethers.Contract(tokenOut, ERC20_ABI);
  const tokenOutDecimals = Number(await erc20OutContract.decimals());
  const tokenOutSymbol: string = await erc20OutContract.symbol();
  const tokenOutName: string = await erc20OutContract.name();

  const swapOpts: SwapOptionsSwapRouter02 = {
    type: SwapType.SWAP_ROUTER_02,
    simulate: {
      fromAddress: config.handlerAddress,
    },
    recipient: config.handlerAddress,
    slippageTolerance: new Percent(100, 10_000),
    deadline: Date.now() + 3_600,
  };
  const chainId = chainIdToUniswapChainIdType(config.chainId);
  const route = await swapRouter.route(
    CurrencyAmount.fromRawAmount(
      new Token(chainId, tokenIn, tokenInDecimals, tokenInSymbol, tokenInName),
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

  return BigInt(route!.quote.toExact());
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
