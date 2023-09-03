import "mocha";
import { expect } from "chai";
import {
  newOpRequestBuilder,
  OperationRequest,
  range,
  NocturneSigner,
  generateRandomSpendingKey,
} from "../src";
import {
  shitcoin,
  ponzi,
  stablescam,
  monkey,
  plutocracy,
  getDummyHex,
  DUMMY_CONTRACT_ADDR,
} from "./utils";

describe("OpRequestBuilder", () => {
  it("builds OperationRequest with 1 action, 1 unwrap, 0 payments, no params set", () => {
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
          contractAddress: DUMMY_CONTRACT_ADDR,
          encodedFunction: getDummyHex(0),
        },
      ],
      chainId: 1n,
      tellerContract: DUMMY_CONTRACT_ADDR,
      deadline: 2n,
    };

    const builder = newOpRequestBuilder({
      chainId: 1n,
      tellerContract: DUMMY_CONTRACT_ADDR,
    });
    const opRequest = builder
      .action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
      .unwrap(shitcoin, 3n)
      .refundAsset(shitcoin)
      .deadline(2n)
      .build();

    expect(opRequest.request).to.eql(expected);
  });

  it("builds OperaionRequest with 1 action, 1 unwrap, 1 payment, no params set", () => {
    const sk = generateRandomSpendingKey();
    const signer = new NocturneSigner(sk);
    const receiver = signer.canonicalAddress();

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
          contractAddress: DUMMY_CONTRACT_ADDR,
          encodedFunction: getDummyHex(0),
        },
      ],
      chainId: 1n,
      tellerContract: DUMMY_CONTRACT_ADDR,
      deadline: 2n,
    };

    const builder = newOpRequestBuilder({
      chainId: 1n,
      tellerContract: DUMMY_CONTRACT_ADDR,
    });
    const opRequest = builder
      .action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
      .unwrap(shitcoin, 3n)
      .refundAsset(shitcoin)
      .confidentialPayment(shitcoin, 1n, receiver)
      .deadline(2n)
      .build();

    expect(opRequest.request).to.eql(expected);
  });

  it("builds OperationRuqestion with 1 action, 1 unwrap, 0 payments, all params set", () => {
    const sk = generateRandomSpendingKey();
    const signer = new NocturneSigner(sk);
    const refundAddr = signer.generateRandomStealthAddress();

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
          contractAddress: DUMMY_CONTRACT_ADDR,
          encodedFunction: getDummyHex(0),
        },
      ],
      refundAddr,
      executionGasLimit: 20n,
      gasPrice: 30n,
      chainId: 1n,
      tellerContract: DUMMY_CONTRACT_ADDR,
      deadline: 2n,
    };

    const builder = newOpRequestBuilder({
      chainId: 1n,
      tellerContract: DUMMY_CONTRACT_ADDR,
    });
    const opRequest = builder
      .action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
      .unwrap(shitcoin, 3n)
      .refundAsset(shitcoin)
      .refundAddr(refundAddr)
      .gas({
        executionGasLimit: 20n,
        gasPrice: 30n,
      })
      .deadline(2n)
      .build();

    expect(opRequest.request).to.eql(expected);
  });

  it("builds operation with 0 actions, 0 unwraps, 2 payments, no params set", () => {
    const receivers = range(2)
      .map((_) => generateRandomSpendingKey())
      .map((sk) => new NocturneSigner(sk))
      .map((signer) => signer.canonicalAddress());

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
      chainId: 1n,
      tellerContract: DUMMY_CONTRACT_ADDR,
      deadline: 2n,
    };

    const builder = newOpRequestBuilder({
      chainId: 1n,
      tellerContract: DUMMY_CONTRACT_ADDR,
    });
    const opRequest = builder
      .confidentialPayment(shitcoin, 1n, receivers[0])
      .confidentialPayment(stablescam, 2n, receivers[1])
      .deadline(2n)
      .build();

    // joinSplitRequests may not necessarily be in the same order, sort them by asset
    expected.joinSplitRequests.sort((a, b) =>
      a.asset.assetAddr.localeCompare(b.asset.assetAddr)
    );
    opRequest.request.joinSplitRequests.sort((a, b) =>
      a.asset.assetAddr.localeCompare(b.asset.assetAddr)
    );

    expect(opRequest.request).to.eql(expected);
  });

  it("builds OperaionRequest with 2 actions, 5 unwraps, 3 payments, 5 different assets, refund addr set", () => {
    const sk = generateRandomSpendingKey();
    const signer = new NocturneSigner(sk);
    const refundAddr = signer.generateRandomStealthAddress();

    const receivers = range(3)
      .map((_) => generateRandomSpendingKey())
      .map((sk) => new NocturneSigner(sk))
      .map((signer) => signer.canonicalAddress());

    const actions = range(2).map((i) => ({
      contractAddress: DUMMY_CONTRACT_ADDR,
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
      chainId: 1n,
      tellerContract: DUMMY_CONTRACT_ADDR,
      deadline: 2n,
    };

    const builder = newOpRequestBuilder({
      chainId: 1n,
      tellerContract: DUMMY_CONTRACT_ADDR,
    });
    const opRequest = builder
      .action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
      .action(DUMMY_CONTRACT_ADDR, getDummyHex(1))
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
      .deadline(2n)
      .build();

    // joinSplitRequests may not necessarily be in the same order, sort them by asset
    expected.joinSplitRequests.sort((a, b) =>
      a.asset.assetAddr.localeCompare(b.asset.assetAddr)
    );
    opRequest.request.joinSplitRequests.sort((a, b) =>
      a.asset.assetAddr.localeCompare(b.asset.assetAddr)
    );

    expect(opRequest.request).to.eql(expected);
  });

  it("combines requests of same asset when no conf payments", () => {
    const sk = generateRandomSpendingKey();
    const signer = new NocturneSigner(sk);
    const refundAddr = signer.generateRandomStealthAddress();

    const actions = range(2).map((i) => ({
      contractAddress: DUMMY_CONTRACT_ADDR,
      encodedFunction: getDummyHex(i),
    }));
    const expected: OperationRequest = {
      joinSplitRequests: [
        {
          asset: shitcoin,
          unwrapValue: 300n,
        },
        {
          asset: ponzi,
          unwrapValue: 300n,
        },
      ],
      refundAssets: [],
      refundAddr: refundAddr,
      actions,
      chainId: 1n,
      tellerContract: DUMMY_CONTRACT_ADDR,
      deadline: 2n,
    };

    const builder = newOpRequestBuilder({
      chainId: 1n,
      tellerContract: DUMMY_CONTRACT_ADDR,
    });
    const opRequest = builder
      .action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
      .action(DUMMY_CONTRACT_ADDR, getDummyHex(1))
      .unwrap(shitcoin, 100n)
      .unwrap(ponzi, 100n)
      .unwrap(shitcoin, 100n)
      .unwrap(ponzi, 100n)
      .unwrap(shitcoin, 100n)
      .unwrap(ponzi, 100n)
      .refundAddr(refundAddr)
      .deadline(2n)
      .build();

    expect(opRequest.request).to.eql(expected);
  });
});
