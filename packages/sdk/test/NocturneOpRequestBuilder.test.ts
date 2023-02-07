import "mocha";
import { expect } from "chai";
import { utils } from "ethers";
import { Asset, AssetType, NocturneOpRequestBuilder, NocturneSigner, OperationRequest } from "../src/sdk";
import { Action } from "../src/contract";
import { NocturnePrivKey, StealthAddressTrait } from "../src/crypto";

const shitcoin: Asset = {
  assetType: AssetType.ERC20,
  assetAddr: "0x123",
  id: 0n,
}

// const ponzi: Asset = {
//   assetType: AssetType.ERC20,
//   assetAddr: "0x456",
//   id: 0n,
// }

// const stablescam: Asset = {
//   assetType: AssetType.ERC20,
//   assetAddr: "0x789",
//   id: 0n,
// }

// const monkey: Asset = {
//   assetType: AssetType.ERC721,
//   assetAddr: "0xabc",
//   id: 1n,
// }

// const plutocracy: Asset = {
//   assetType: AssetType.ERC1155,
//   assetAddr: "0xdef",
//   id: 1n,
// }

function getDummyAction(bump: number): Action {
  const encodedFunction = utils.keccak256("0x" + bump.toString(16).padStart(64, "0"));
  return {
    contractAddress: "0x1234",
    encodedFunction,
  }
}

describe("NocturneOpRequestBuilder", () => {
  const privkey = NocturnePrivKey.genPriv();
  const signer = new NocturneSigner(privkey);
  const baseAddr = signer.address;

  it("builds OperaionRequest with 1 action, 1 unwrap, 0 payments, no params set", () => {
    const expected: OperationRequest = {
      joinSplitRequests: [
        {
          asset: shitcoin,
          unwrapValue: 3n,
        }
      ],
      refundAssets: [shitcoin],
      actions: [getDummyAction(0)]
    }

    const builder = new NocturneOpRequestBuilder();
    const opRequest = builder
      .action(getDummyAction(0))
      .unwrap(shitcoin, 3n)
      .refundAsset(shitcoin)
      .build();

    expect(opRequest).to.eql(expected);
  })

  it("builds OperaionRequest with 1 action, 1 unwrap, 1 payments, no params set", () => {
    const receiver = StealthAddressTrait.randomize(baseAddr);
    const expected: OperationRequest = {
      joinSplitRequests: [
        {
          asset: shitcoin,
          unwrapValue: 3n,
          payment: {
            receiver,
            value: 1n,
          }
        }
      ],
      refundAssets: [shitcoin],
      actions: [getDummyAction(0)]
    }

    const builder = new NocturneOpRequestBuilder();
    const opRequest = builder
      .action(getDummyAction(0))
      .unwrap(shitcoin, 3n)
      .refundAsset(shitcoin)
      .build();

    expect(opRequest).to.eql(expected);
  })
})