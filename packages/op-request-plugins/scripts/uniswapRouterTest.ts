import { AlphaRouter } from "@uniswap/smart-order-router";
import { ethers } from "ethers";
import { currencyAmountToBigInt, getSwapRoute } from "../src/UniswapV3Plugin";
import { Percent } from "@uniswap/sdk-core";
import dotenv from "dotenv";

const MAINNET_WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const MAINNET_SUSD_ADDRESS = "0x57Ab1ec28D129707052df4dF418D58a2D46d5f51";

dotenv.config();

async function run() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);

  const swapRouter = new AlphaRouter({
    chainId: 1,
    provider,
  });
  const route = await getSwapRoute({
    router: swapRouter,
    chainId: 1n,
    provider,
    fromAddress: "0x9dD6B628336ECA9a57e534Fb25F1960fA11038f4",
    tokenInAddress: MAINNET_WETH_ADDRESS,
    amountIn: 1000000000000000000n, // 1 ETH
    tokenOutAddress: MAINNET_SUSD_ADDRESS,
    maxSlippageBps: 50,
  });
  if (!route) {
    throw new Error("Route returned not defined");
  }
  console.log("Route", JSON.stringify(route));
  console.log("OUTPUT AMOUNT", route.trade.outputAmount.toExact());
  console.log(
    "MIN OUT",
    route.trade.minimumAmountOut(new Percent(50, 10_000)).toExact()
  );
  console.log("QUOTE 1 weth for SUSD:" + route.quote.toExact());
  console.log("to:", route.methodParameters?.to);
  console.log("calldata:", route.methodParameters?.calldata);

  console.log("out amount FIXED", route.trade.outputAmount.toFixed());
  console.log("out amount EXACT", route.trade.outputAmount.toExact());
  console.log(
    "out amount SIGNIFICANT",
    route.trade.outputAmount.toSignificant()
  );
  console.log(
    "amount out CORRECT",
    currencyAmountToBigInt(route.trade.outputAmount)
  );
}
run().catch((error) => {
  console.error("An error occurred:", error);
});
