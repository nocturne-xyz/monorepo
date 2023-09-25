import { AlphaRouter } from "@uniswap/smart-order-router";
import { ethers } from "ethers";
import { getSwapRoute } from "../src/helpers/uniswapV3";

(async () => {
  const provider = new ethers.providers.JsonRpcProvider(
    "https://eth-mainnet.g.alchemy.com/v2/X21iuJe_hcEAH4cooxG7xGuTQ-ebJJmB"
  );
  const router = new AlphaRouter({
    chainId: 1,
    provider,
    // simulator: new Simulator(provider, 1)
  });

  const route = await getSwapRoute(
    router,
    1n,
    provider,
    "0x9dD6B628336ECA9a57e534Fb25F1960fA11038f4",
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH address
    BigInt(1000000000000000000), // 1 ETH
    "0x6B175474E89094C44Da98b954EedeAC495271d0F" // USDC address
  );

  console.log("QUOTE 1 weth for usdc:" + route.quote.toExact());
  console.log("to:", route.methodParameters?.to);
  console.log("calldata:", route.methodParameters?.calldata);
})();
