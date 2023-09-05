import "mocha";
import { expect } from "chai";
import { Erc20Plugin, WstethAdapterPlugin } from "../src";
import {
  newOpRequestBuilder,
  NocturneSigner,
  generateRandomSpendingKey,
  OperationRequestWithMetadata,
  AssetTrait,
} from "@nocturne-xyz/core";
import { ethers } from "ethers";
import ERC20_ABI from "../src/abis/ERC20.json";
import { WstethAdapter__factory } from "@nocturne-xyz/contracts";
import {
  DUMMY_CONTRACT_ADDR,
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

    const builder = newOpRequestBuilder({
      chainId: 1n,
      tellerContract: DUMMY_CONTRACT_ADDR,
    });
    const recipient = ethers.utils.getAddress(
      "0x1E2cD78882b12d3954a049Fd82FFD691565dC0A5"
    );

    const opRequest = await builder
      .use(Erc20Plugin)
      .use(WstethAdapterPlugin)
      .erc20Transfer(shitcoin.assetAddr, recipient, 100n)
      .convertWethToWsteth(100n)
      .refundAddr(refundAddr)
      .deadline(2n)
      .build();

    const contract = new ethers.Contract(shitcoin.assetAddr, ERC20_ABI);
    const encodedTransferFunction = contract.interface.encodeFunctionData(
      "transfer",
      [recipient, 100n]
    );

    const encodedWeth = AssetTrait.erc20AddressToAsset(WETH_ADDRESS);
    const encodedWsteth = AssetTrait.erc20AddressToAsset(WSTETH_ADDRESS);
    const encodedWstethConvertFunction =
      WstethAdapter__factory.createInterface().encodeFunctionData("convert", [
        100n,
      ]);

    const expected: OperationRequestWithMetadata = {
      request: {
        joinSplitRequests: [
          {
            asset: shitcoin,
            unwrapValue: 100n,
          },
          {
            asset: encodedWeth,
            unwrapValue: 100n,
          },
        ],
        refundAssets: [encodedWsteth],
        refundAddr: refundAddr,
        actions: [
          {
            contractAddress: shitcoin.assetAddr,
            encodedFunction: encodedTransferFunction,
          },
          {
            contractAddress: WSTETH_ADAPTER_ADDRESS,
            encodedFunction: encodedWstethConvertFunction,
          },
        ],
        chainId: 1n,
        tellerContract: DUMMY_CONTRACT_ADDR,
        deadline: 2n,
      },
      meta: {
        items: [
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
});
