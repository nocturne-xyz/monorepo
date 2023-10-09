import { newOpRequestBuilder } from "@nocturne-xyz/client";
import { ethers } from "ethers";
import { UniswapV3Plugin } from "../src";
import * as JSON from "bigint-json-serialization";
import dotenv from "dotenv";

const MAINNET_WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const MAINNET_SUSD_ADDRESS = "0x57Ab1ec28D129707052df4dF418D58a2D46d5f51";

dotenv.config();

(async () => {
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);

  console.log("creating op request");
  const chainId = 1n;
  const opRequestWithMetadata = await newOpRequestBuilder(provider, chainId)
    .use(UniswapV3Plugin)
    .swap(
      MAINNET_WETH_ADDRESS,
      1000000000000000000n, // 1 ETH
      MAINNET_SUSD_ADDRESS,
      50
    )
    .build();

  console.log("opRequestWithMetadata:", JSON.stringify(opRequestWithMetadata));
})();
