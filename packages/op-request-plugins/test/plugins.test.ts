import "mocha";
import { expect } from "chai";
import {
  Erc20Plugin,
  EthTransferAdapterPlugin,
  UniswapV3Plugin,
  WstethAdapterPlugin,
} from "../src";
import {
  newOpRequestBuilder,
  NocturneSigner,
  generateRandomSpendingKey,
  OperationRequestWithMetadata,
  AssetTrait,
} from "@nocturne-xyz/core";
import { ethers } from "ethers";
import ERC20_ABI from "../src/abis/ERC20.json";
import {
  EthTransferAdapter__factory,
  WstethAdapter__factory,
} from "@nocturne-xyz/contracts";
import {
  DUMMY_CONFIG,
  ETH_TRANSFER_ADAPTER_ADDRESS,
  WETH_ADDRESS,
  WSTETH_ADAPTER_ADDRESS,
  WSTETH_ADDRESS,
  shitcoin,
} from "./utils";

describe("OpRequestBuilder", () => {
  it("uses plugins", async () => {
    const sk = generateRandomSpendingKey();
    const signer = new NocturneSigner(sk);
    const refundAddr = signer.generateRandomStealthAddress();

    const provider = ethers.getDefaultProvider();
    const builder = newOpRequestBuilder(provider, 1n, DUMMY_CONFIG);
    const recipient = ethers.utils.getAddress(
      "0x1E2cD78882b12d3954a049Fd82FFD691565dC0A5"
    );

    const opRequest = await builder
      .use(Erc20Plugin)
      .use(EthTransferAdapterPlugin)
      .use(WstethAdapterPlugin)
      .use(UniswapV3Plugin)
      .transferEth(recipient, 200n)
      .erc20Transfer(shitcoin.assetAddr, recipient, 100n)
      .convertWethToWsteth(100n)
      .refundAddr(refundAddr)
      .deadline(2n)
      .build();

    const erc20Contract = new ethers.Contract(shitcoin.assetAddr, ERC20_ABI);

    const wethAsset = AssetTrait.erc20AddressToAsset(WETH_ADDRESS);
    const wstethAsset = AssetTrait.erc20AddressToAsset(WSTETH_ADDRESS);

    const expected: OperationRequestWithMetadata = {
      request: {
        joinSplitRequests: [
          {
            asset: wethAsset,
            unwrapValue: 300n, // 200 for eth transfer, 100 for wsteth convert
          },
          {
            asset: shitcoin,
            unwrapValue: 100n,
          },
        ],
        refunds: [
          {
            encodedAsset: AssetTrait.encode(wstethAsset),
            minRefundValue: 100n,
          },
        ],
        refundAddr: refundAddr,
        actions: [
          {
            contractAddress: WETH_ADDRESS,
            encodedFunction: erc20Contract.interface.encodeFunctionData(
              "approve",
              [ETH_TRANSFER_ADAPTER_ADDRESS, 200n]
            ),
          },
          {
            contractAddress: ETH_TRANSFER_ADAPTER_ADDRESS,
            encodedFunction:
              EthTransferAdapter__factory.createInterface().encodeFunctionData(
                "transfer",
                [recipient, 200n]
              ),
          },
          {
            contractAddress: shitcoin.assetAddr,
            encodedFunction: erc20Contract.interface.encodeFunctionData(
              "transfer",
              [recipient, 100n]
            ),
          },
          {
            contractAddress: WETH_ADDRESS,
            encodedFunction: erc20Contract.interface.encodeFunctionData(
              "approve",
              [WSTETH_ADAPTER_ADDRESS, 100n]
            ),
          },
          {
            contractAddress: WSTETH_ADAPTER_ADDRESS,
            encodedFunction:
              WstethAdapter__factory.createInterface().encodeFunctionData(
                "convert",
                [100n]
              ),
          },
        ],
        chainId: 1n,
        tellerContract: DUMMY_CONFIG.tellerAddress(),
        deadline: 2n,
      },
      meta: {
        items: [
          {
            type: "Action",
            actionType: "Transfer ETH",
            to: recipient,
            value: 200n,
          },
          {
            type: "Action",
            actionType: "Transfer",
            recipientAddress: recipient,
            erc20Address: shitcoin.assetAddr,
            amount: 100n,
          },
          {
            type: "Action",
            actionType: "Weth To Wsteth",
            amount: 100n,
          },
        ],
      },
    };

    expect(opRequest).to.eql(expected);
  });

  // TODO: figure out how to unit test uniswap plugin if possible (network calls make it tough)
});
