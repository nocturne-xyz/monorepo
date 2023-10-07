export type UniswapProtocol = "V2" | "V3";

export interface ExactInputSingleParams {
  tokenIn: string;
  tokenOut: string;
  fee: number;
  recipient: string;
  deadline: number;
  amountIn: bigint;
  amountOutMinimum: bigint;
  sqrtPriceLimitX96: number;
}

export interface ExactInputParams {
  path: string;
  recipient: string;
  deadline: number;
  amountIn: bigint;
  amountOutMinimum: bigint;
}
