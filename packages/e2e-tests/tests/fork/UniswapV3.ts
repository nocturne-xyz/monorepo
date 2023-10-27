import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { setupTestDeployment } from "../../src/deploy";
import { ethers } from "ethers";
import { newOpRequestBuilder } from "@nocturne-xyz/client";
import { NocturneConfig } from "@nocturne-xyz/config";
import { UniswapV3Plugin } from "@nocturne-xyz/op-request-plugins";
import { WETH9__factory } from "@nocturne-xyz/contracts";
import ERC20_ABI from "../../abis/ERC20.json";

chai.use(chaiAsPromised);

const MAINNET_WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const MAINNET_USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const MAINNET_DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const MAINNET_SUSD_ADDRESS = "0x57Ab1ec28D129707052df4dF418D58a2D46d5f51";
const ONE_ETHER = 1000000000000000000n;

describe("UniswapV3 Adapter fork", async () => {
  let teardown: () => Promise<void>;

  let provider: ethers.providers.JsonRpcProvider;
  let aliceEoa: ethers.Wallet;

  let config: NocturneConfig;

  beforeEach(async () => {
    // Deploy to hh node as mainnet fork, no actors on
    const testDeployment = await setupTestDeployment(
      {
        include: {
          bundler: false,
          subtreeUpdater: false,
          subgraph: false,
          depositScreener: false,
        },
      },
      // Include extra tokens to whitelist in uniswap adapter
      [
        [
          "weth",
          {
            address: MAINNET_WETH_ADDRESS,
            globalCapWholeTokens: 5000n,
            maxDepositSizeWholeTokens: 1000n,
            resetWindowHours: 24n,
            precision: 18n,
            isGasAsset: true,
          },
        ],
        [
          "usdc",
          {
            address: MAINNET_USDC_ADDRESS,
            globalCapWholeTokens: 5000n,
            maxDepositSizeWholeTokens: 1000n,
            resetWindowHours: 24n,
            precision: 6n,
            isGasAsset: false,
          },
        ],
        [
          "dai",
          {
            address: MAINNET_DAI_ADDRESS,
            globalCapWholeTokens: 5000n,
            maxDepositSizeWholeTokens: 1000n,
            resetWindowHours: 24n,
            precision: 18n,
            isGasAsset: false,
          },
        ],
        [
          "susd",
          {
            address: MAINNET_SUSD_ADDRESS,
            globalCapWholeTokens: 5000n,
            maxDepositSizeWholeTokens: 1000n,
            resetWindowHours: 24n,
            precision: 18n,
            isGasAsset: false,
          },
        ],
      ],
      {
        // Include UniswapV3Adapter
        uniswapV3AdapterDeployConfig: {
          swapRouterAddress: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        },
      },
      "mainnet"
    );

    ({ provider, teardown, config, aliceEoa } = testDeployment);
  });

  afterEach(async () => {
    await teardown();
  });

  it("submits single hop request to UniswapV3 without Nocturne", async () => {
    console.log("creating op request");
    const chainId = 1n;
    const opRequestWithMetadata = await newOpRequestBuilder(
      provider,
      chainId,
      config
    )
      .use(UniswapV3Plugin)
      .swap(MAINNET_WETH_ADDRESS, ONE_ETHER, MAINNET_DAI_ADDRESS, {
        maxSlippageBps: 50,
        recipient: aliceEoa.address,
      })
      .build();

    console.log("opRequestWithMetadata:", opRequestWithMetadata);

    const {
      contractAddress: wethAddress,
      encodedFunction: approveEncodedFunction,
    } = opRequestWithMetadata.request.actions[0];
    const {
      contractAddress: uniswapAdapterAddress,
      encodedFunction: swapEncodedFunction,
    } = opRequestWithMetadata.request.actions[1];

    const weth = WETH9__factory.connect(MAINNET_WETH_ADDRESS, aliceEoa);
    const dai = new ethers.Contract(MAINNET_DAI_ADDRESS, ERC20_ABI, aliceEoa);

    console.log("depositing ETH into WETH");
    await weth.deposit({ value: 2000000000000000000n }); // 2 ETH

    console.log("approving weth to uniswap");
    await aliceEoa.sendTransaction({
      to: wethAddress,
      data: approveEncodedFunction,
    });

    console.log("sending swap tx");
    await aliceEoa.sendTransaction({
      to: uniswapAdapterAddress,
      data: swapEncodedFunction,
    });

    expect((await weth.balanceOf(aliceEoa.address)).toBigInt()).to.equal(
      ONE_ETHER
    );
    expect(Number(await dai.balanceOf(aliceEoa.address))).to.gt(
      1_000 * 10 ** 18
    ); // > 1000 DAI (dumb estimate, so we don't have to estimate quote twice given latency)
  });

  it("submits multihop request to UniswapV3 without Nocturne", async () => {
    console.log("creating op request");
    const chainId = 1n;
    const opRequestWithMetadata = await newOpRequestBuilder(
      provider,
      chainId,
      config
    )
      .use(UniswapV3Plugin)
      .swap(MAINNET_WETH_ADDRESS, ONE_ETHER, MAINNET_SUSD_ADDRESS, {
        maxSlippageBps: 50,
        recipient: aliceEoa.address,
      })
      .build();

    console.log("opRequestWithMetadata:", opRequestWithMetadata);

    const {
      contractAddress: wethAddress,
      encodedFunction: approveEncodedFunction,
    } = opRequestWithMetadata.request.actions[0];
    const {
      contractAddress: swapRouterAddress,
      encodedFunction: swapEncodedFunction,
    } = opRequestWithMetadata.request.actions[1];

    const weth = WETH9__factory.connect(MAINNET_WETH_ADDRESS, aliceEoa);
    const susd = new ethers.Contract(MAINNET_SUSD_ADDRESS, ERC20_ABI, aliceEoa);

    console.log("depositing ETH into WETH");
    await weth.deposit({ value: 2000000000000000000n }); // 2 ETH

    console.log("approving weth to uniswap");
    await aliceEoa.sendTransaction({
      to: wethAddress,
      data: approveEncodedFunction,
    });

    console.log("sending swap tx");
    const swapTx = await aliceEoa.sendTransaction({
      to: swapRouterAddress,
      data: swapEncodedFunction,
    });

    console.log("tx response:", swapTx);

    expect((await weth.balanceOf(aliceEoa.address)).toBigInt()).to.equal(
      ONE_ETHER
    );
    expect(Number(await susd.balanceOf(aliceEoa.address))).to.gt(
      1_000 * 10 ** 18
    ); // > 1000 SUSD (dumb estimate, so we don't have to estimate quote twice given latency)
  });
});
