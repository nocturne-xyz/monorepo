import "mocha";
import { expect } from "chai";
import { AssetTrait, AssetType } from "../src";

describe("AssetTrait", () => {
  it("correctly encodes assets with small id", async () => {
    // small id
    const asset = {
      assetType: AssetType.ERC20,
      assetAddr: "0x123",
      id: 1n,
    };

    const { encodedAssetAddr, encodedAssetId } = AssetTrait.encode(asset);
    const encodedAssetBits = encodedAssetAddr.toString(2).padStart(256, "0");
    const encodedIDBits = encodedAssetId.toString(2).padStart(256, "0");

    // bit length should be 256 after padding. if it's not, then the encoding is too long
    expect(encodedAssetBits.length).to.equal(256);
    expect(encodedIDBits.length).to.equal(256);

    // first 3 bits should be 0
    expect(encodedAssetBits.slice(0, 3)).to.deep.equal("000");
    // next 3 bits should be first 3 bits of id, which should be 000 in this case
    expect(encodedAssetBits.slice(3, 6)).to.deep.equal("000");

    // last 160 bits should be asset
    expect(BigInt(`0b${encodedAssetBits.slice(96)}`)).to.equal(
      BigInt(asset.assetAddr)
    );

    // first 3 bits should be 0
    expect(encodedIDBits.slice(0, 3)).to.deep.equal("000");
    // last 253 bits should be last 253 bits of id
    expect(BigInt(`0b${encodedIDBits.slice(3)}`)).to.equal(asset.id);
  });

  it("correctly encodes assets with big id", async () => {
    // big id
    const asset = {
      assetType: AssetType.ERC20,
      assetAddr: "0x123",
      id: 2n ** 256n - 1n,
    };
    const idBits = asset.id.toString(2).padStart(256, "0");

    const { encodedAssetAddr, encodedAssetId } = AssetTrait.encode(asset);

    const encodedAssetBits = encodedAssetAddr.toString(2).padStart(256, "0");
    const encodedIDBits = encodedAssetId.toString(2).padStart(256, "0");

    // bit length should be 256 after padding. if it's not, then the encoding is too long
    expect(encodedAssetBits.length).to.equal(256);
    expect(encodedIDBits.length).to.equal(256);

    // first 3 bits should be 0
    expect(encodedAssetBits.slice(0, 3)).to.deep.equal("000");
    // next 3 bits should be first 3 bits of id, which should be 111 in this case
    expect(encodedAssetBits.slice(3, 6)).to.deep.equal("111");
    expect(BigInt(`0b${encodedAssetBits.slice(96)}`)).to.equal(
      BigInt(asset.assetAddr)
    );

    // first 3 bits should be 0
    expect(encodedIDBits.slice(0, 3)).to.deep.equal("000");
    // last 253 bits should be last 253 bits of id
    expect(BigInt(`0b${encodedIDBits.slice(3)}`)).to.equal(
      BigInt(`0b${idBits.slice(3)}`)
    );
  });
});
