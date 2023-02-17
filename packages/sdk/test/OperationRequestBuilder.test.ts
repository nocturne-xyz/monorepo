import "mocha";
import { expect } from "chai";
import { OperationRequestBuilder, OperationRequest, range, NocturneSigner } from "../src";
import {
  shitcoin,
  ponzi,
  stablescam,
  monkey,
  plutocracy,
  getDummyHex,
} from "./utils";

describe("OperationRequestBuilder", () => {
  it("builds OperaionRequest with 1 action, 1 unwrap, 0 payments, no params set", () => {
    const expected: OperationRequest = {
      joinSplitRequests: [
        {
          asset: shitcoin,
          unwrapValue: 3n,
        },
      ],
      refundAssets: [shitcoin],
      actions: [
        {
          contractAddress: "0x1234",
          encodedFunction: getDummyHex(0),
        },
      ],
    };

    const builder = new OperationRequestBuilder();
    const opRequest = builder
      .action("0x1234", getDummyHex(0))
      .unwrap(shitcoin, 3n)
      .refundAsset(shitcoin)
      .build();

    expect(opRequest).to.eql(expected);
  });

  it("builds OperaionRequest with 1 action, 1 unwrap, 1 payment, no params set", () => {
    const signer = NocturneSigner.genRandom();
    const receiver = signer.getCanonicalAddress();

    const expected: OperationRequest = {
      joinSplitRequests: [
        {
          asset: shitcoin,
          unwrapValue: 3n,
          payment: {
            receiver,
            value: 1n,
          },
        },
      ],
      refundAssets: [shitcoin],
      actions: [
        {
          contractAddress: "0x1234",
          encodedFunction: getDummyHex(0),
        },
      ],
    };

    const builder = new OperationRequestBuilder();
    const opRequest = builder
      .action("0x1234", getDummyHex(0))
      .unwrap(shitcoin, 3n)
      .refundAsset(shitcoin)
      .confidentialPayment(shitcoin, 1n, receiver)
      .build();

    expect(opRequest).to.eql(expected);
  });

  it("builds OperationRuqestion with 1 action, 1 unwrap, 0 payments, all params set", () => {
    const signer = NocturneSigner.genRandom();
    const refundAddr = signer.getRandomStealthAddress();

    const expected: OperationRequest = {
      joinSplitRequests: [
        {
          asset: shitcoin,
          unwrapValue: 3n,
        },
      ],
      refundAssets: [shitcoin],
      actions: [
        {
          contractAddress: "0x1234",
          encodedFunction: getDummyHex(0),
        },
      ],
      refundAddr,
      verificationGasLimit: 10n,
      executionGasLimit: 20n,
      gasPrice: 30n,
      maxNumRefunds: 1n,
    };

    const builder = new OperationRequestBuilder();
    const opRequest = builder
      .action("0x1234", getDummyHex(0))
      .unwrap(shitcoin, 3n)
      .refundAsset(shitcoin)
      .refundAddr(refundAddr)
      .gas({
        verificationGasLimit: 10n,
        executionGasLimit: 20n,
        gasPrice: 30n,
      })
      .maxNumRefunds(1n)
      .build();

    expect(opRequest).to.eql(expected);
  });

  it("builds operation with 0 actions, 0 unwraps, 2 payments, no params set", () => {
    const receivers = range(2)
      .map((_) => NocturneSigner.genRandom())
      .map((signer) => signer.getCanonicalAddress());

    const expected: OperationRequest = {
      joinSplitRequests: [
        {
          asset: shitcoin,
          unwrapValue: 0n,
          payment: {
            receiver: receivers[0],
            value: 1n,
          },
        },
        {
          asset: stablescam,
          unwrapValue: 0n,
          payment: {
            receiver: receivers[1],
            value: 2n,
          },
        },
      ],
      refundAssets: [],
      actions: [],
    };

    const builder = new OperationRequestBuilder();
    const opRequest = builder
      .confidentialPayment(shitcoin, 1n, receivers[0])
      .confidentialPayment(stablescam, 2n, receivers[1])
      .build();

    // joinSplitRequests may not necessarily be in the same order, sort them by asset
    expected.joinSplitRequests.sort((a, b) =>
      a.asset.assetAddr.localeCompare(b.asset.assetAddr)
    );
    opRequest.joinSplitRequests.sort((a, b) =>
      a.asset.assetAddr.localeCompare(b.asset.assetAddr)
    );

    expect(opRequest).to.eql(expected);
  });

  it("builds OperaionRequest with 2 actions, 5 unwraps, 3 payments, 5 different assets, refund addr set", () => {
    const signer = NocturneSigner.genRandom();
    const refundAddr = signer.getRandomStealthAddress();

    const receivers = range(3)
      .map((_) => NocturneSigner.genRandom())
      .map((signer) => signer.getCanonicalAddress());
    const actions = range(2).map((i) => ({
      contractAddress: "0x1234",
      encodedFunction: getDummyHex(i),
    }));
    const expected: OperationRequest = {
      joinSplitRequests: [
        {
          asset: shitcoin,
          unwrapValue: 3n,
          payment: {
            receiver: receivers[0],
            value: 1n,
          },
        },
        {
          asset: ponzi,
          unwrapValue: 69n,
          payment: {
            receiver: receivers[1],
            value: 2n,
          },
        },
        {
          asset: stablescam,
          unwrapValue: 420n,
        },
        {
          asset: monkey,
          unwrapValue: 1n,
          payment: {
            receiver: receivers[2],
            value: 1n,
          },
        },
        {
          asset: plutocracy,
          unwrapValue: 100n,
        },
      ],
      refundAssets: [shitcoin, ponzi, stablescam, plutocracy],
      refundAddr: refundAddr,
      actions,
    };

    const builder = new OperationRequestBuilder();
    const opRequest = builder
      .action("0x1234", getDummyHex(0))
      .action("0x1234", getDummyHex(1))
      .unwrap(shitcoin, 3n)
      .unwrap(ponzi, 69n)
      .unwrap(stablescam, 420n)
      .unwrap(monkey, 1n)
      .unwrap(plutocracy, 100n)
      .confidentialPayment(shitcoin, 1n, receivers[0])
      .confidentialPayment(ponzi, 2n, receivers[1])
      .confidentialPayment(monkey, 1n, receivers[2])
      .refundAsset(shitcoin)
      .refundAsset(ponzi)
      .refundAsset(stablescam)
      .refundAsset(plutocracy)
      .refundAddr(refundAddr)
      .build();

    // joinSplitRequests may not necessarily be in the same order, sort them by asset
    expected.joinSplitRequests.sort((a, b) =>
      a.asset.assetAddr.localeCompare(b.asset.assetAddr)
    );
    opRequest.joinSplitRequests.sort((a, b) =>
      a.asset.assetAddr.localeCompare(b.asset.assetAddr)
    );

    expect(opRequest).to.eql(expected);
  });
});
