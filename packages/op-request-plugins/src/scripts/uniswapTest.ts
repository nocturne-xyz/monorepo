import { AlphaRouter } from "@uniswap/smart-order-router";
import { ethers } from "ethers";
import { getSwapRoute } from "../UniswapV3Plugin";
import { Percent } from "@uniswap/sdk-core";

const INFO_BY_CHAIN = {
  MAINNET: {
    chainId: 1,
    rpcUrl:
      "https://eth-mainnet.g.alchemy.com/v2/X21iuJe_hcEAH4cooxG7xGuTQ-ebJJmB",
    wethAddress: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    daiAddress: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  },
  GOERLI: {
    chainId: 5,
    rpcUrl:
      "https://eth-goerli.g.alchemy.com/v2/X21iuJe_hcEAH4cooxG7xGuTQ-ebJJmB",
    wethAddress: "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",
    daiAddress: "0x11fE4B6AE13d2a6055C8D9cF65c55bac32B5d844",
  },
};
const CHAIN = INFO_BY_CHAIN.MAINNET;
async function run() {
  const provider = new ethers.providers.JsonRpcProvider(CHAIN.rpcUrl);
  const swapRouter = new AlphaRouter({
    chainId: CHAIN.chainId,
    provider,
  });
  const route = await getSwapRoute({
    router: swapRouter,
    chainId: BigInt(CHAIN.chainId),
    provider,
    fromAddress: "0x9dD6B628336ECA9a57e534Fb25F1960fA11038f4",
    tokenInAddress: CHAIN.wethAddress,
    amountIn: 1000000000000000000n, // 1 ETH
    tokenOutAddress: CHAIN.daiAddress,
    maxSlippageBps: 50,
  });
  if (!route) {
    throw new Error("Route returned not defined");
  }
  console.log("Route", route);
  console.log("OUTPUT AMOUNT", route.trade.outputAmount.toExact());
  console.log(
    "MIN OUT",
    route.trade.minimumAmountOut(new Percent(50, 10_000)).toExact()
  );
  console.log("QUOTE 1 weth for usdc:" + route.quote.toExact());
  console.log("to:", route.methodParameters?.to);
  console.log("calldata:", route.methodParameters?.calldata);
}
run().catch((error) => {
  console.error("An error occurred:", error);
});
