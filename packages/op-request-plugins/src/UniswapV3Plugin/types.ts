interface ExactInputSingleParams {
  tokenIn: string;
  tokenOut: string;
  fee: number;
  recipient: string;
  deadline: number;
  amountIn: bigint;
  amountOutMinimum: bigint;
  sqrtPriceLimitX96: number;
}

interface ExactInputParams {
  path: string;
  recipient: string;
  deadline: number;
  amountIn: number;
  amountOutMinimum: number;
}
