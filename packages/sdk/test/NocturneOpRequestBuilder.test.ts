import "mocha";
import _ from "lodash";
import { expect } from "chai";
import { utils } from "ethers";
import {
  Asset,
  AssetType,
  NocturneOpRequestBuilder,
  OperationRequest,
} from "../src/sdk";
import { Action } from "../src/contract";
import { NocturnePrivKey } from "../src/crypto";

const shitcoin: Asset = {
  assetType: AssetType.ERC20,
  assetAddr: "0x123",
  id: 0n,
};

const ponzi: Asset = {
  assetType: AssetType.ERC20,
  assetAddr: "0x456",
  id: 0n,
};

const stablescam: Asset = {
  assetType: AssetType.ERC20,
  assetAddr: "0x789",
  id: 0n,
};

const monkey: Asset = {
  assetType: AssetType.ERC721,
  assetAddr: "0xabc",
  id: 1n,
};

const plutocracy: Asset = {
  assetType: AssetType.ERC1155,
  assetAddr: "0xdef",
  id: 1n,
};

function getDummyAction(bump: number): Action {
  const encodedFunction = utils.keccak256(
    "0x" + bump.toString(16).padStart(64, "0")
  );
  return {
    contractAddress: "0x1234",
    encodedFunction,
  };
}

describe("NocturneOpRequestBuilder", () => {
  it("builds OperaionRequest with 1 action, 1 unwrap, 0 payments, no params set", () => {
    const expected: OperationRequest = {
      joinSplitRequests: [
        {
          asset: shitcoin,
          unwrapValue: 3n,
        },
      ],
      refundAssets: [shitcoin],
      actions: [getDummyAction(0)],
    };

    const builder = new NocturneOpRequestBuilder();
    const opRequest = builder
      .action(getDummyAction(0))
      .unwrap(shitcoin, 3n)
      .refundAsset(shitcoin)
      .build();

    expect(opRequest).to.eql(expected);
  });

  it("builds OperaionRequest with 1 action, 1 unwrap, 1 payment, no params set", () => {
    const receiverPriv = NocturnePrivKey.genPriv();
    const receiver = receiverPriv.toCanonAddress();
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
      actions: [getDummyAction(0)],
    };

    const builder = new NocturneOpRequestBuilder();
    const opRequest = builder
      .action(getDummyAction(0))
      .unwrap(shitcoin, 3n)
      .refundAsset(shitcoin)
      .confidentialPayment(shitcoin, 1n, receiver)
      .build();

    expect(opRequest).to.eql(expected);
  });

  it("builds OperationRuqestion with 1 action, 1 unwrap, 0 payments, all params set", () => {
    const refundPriv = NocturnePrivKey.genPriv();
    const refundAddr = refundPriv.toAddress();

    const expected: OperationRequest = {
      joinSplitRequests: [
        {
          asset: shitcoin,
          unwrapValue: 3n,
        },
      ],
      refundAssets: [shitcoin],
      actions: [getDummyAction(0)],
      refundAddr,
      verificationGasLimit: 10n,
      executionGasLimit: 20n,
      gasPrice: 30n,
      maxNumRefunds: 1n,
    };

    const builder = new NocturneOpRequestBuilder();
    const opRequest = builder
      .action(getDummyAction(0))
      .unwrap(shitcoin, 3n)
      .refundAsset(shitcoin)
      .refundAddr(refundAddr)
      .gas(10n, 20n, 30n)
      .maxNumRefunds(1n)
      .build();

    expect(opRequest).to.eql(expected);
  });

  it("builds OperaionRequest with 2 actions, 5 unwraps, 3 payments, 5 different assets, refund addr set", () => {
    const refundPriv = NocturnePrivKey.genPriv();
    const refundAddr = refundPriv.toAddress();

    const receivers = _.range(3)
      .map((_) => NocturnePrivKey.genPriv())
      .map((priv) => priv.toCanonAddress());
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
      actions: [getDummyAction(0), getDummyAction(1)],
    };

    const builder = new NocturneOpRequestBuilder();
    const opRequest = builder
      .action(getDummyAction(0))
      .action(getDummyAction(1))
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
