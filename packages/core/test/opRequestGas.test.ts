import "mocha";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { expect } from "chai";
import { Asset, AssetType, newOpRequestBuilder } from "../src";
import {
  setup,
  shitcoin,
  getDummyHex,
  testGasAssets,
  stablescam,
  DUMMY_CONTRACT_ADDR,
  DUMMY_CONFIG,
} from "./utils";
import { handleGasForOperationRequest } from "../src/opRequestGas";
import { ERC20_ID } from "../src/primitives/asset";
import { JoinSplitRequest } from "../src/operationRequest/operationRequest";
import { MockEthToTokenConverter } from "../src/conversion";
import { ethers } from "ethers";
import { maxGasForAdditionalJoinSplit } from "../src/primitives/gasCalculation";

chai.use(chaiAsPromised);

const DUMMY_GAS_ASSET: Asset = {
  assetType: AssetType.ERC20,
  assetAddr: "0x0000000000000000000000000000000000000000",
  id: ERC20_ID,
};

describe("handleGasForOperationRequest", async () => {
  it("produces an operation request with gas price 0 and dummy gas asset when gasPrice set to 0", async () => {
    const [nocturneDB, merkleProver, signer, handlerContract] = await setup(
      [500_000n, 500_000n],
      [shitcoin, shitcoin]
    );
    const deps = {
      db: nocturneDB,
      handlerContract,
      merkle: merkleProver,
      viewer: signer,
      gasAssets: testGasAssets,
      tokenConverter: new MockEthToTokenConverter(),
    };

    const provider = ethers.getDefaultProvider();
    const builder = newOpRequestBuilder(provider, 1n, DUMMY_CONFIG);
    const opRequest = await builder
      .__action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
      .__unwrap(shitcoin, 3n)
      .__refund({ asset: shitcoin, minRefundValue: 1n })
      .gas({
        executionGasLimit: 1_000_000n,
        gasPrice: 0n,
      })
      .deadline(1n)
      .build();

    const gasCompAccountedOpRequest = await handleGasForOperationRequest(
      deps,
      opRequest.request
    );

    expect(gasCompAccountedOpRequest.gasPrice).to.eql(0n);
    expect(gasCompAccountedOpRequest.gasAsset).to.eql(DUMMY_GAS_ASSET);
  });

  it("adds gas comp to existing joinsplit when gas price is nonzero, there exists a joinsplit unwrapping gasAsset, and user has enough", async () => {
    const [nocturneDB, merkleProver, signer, handlerContract] = await setup(
      [500_000n, 500_000n, 2_000_000n],
      [shitcoin, shitcoin, shitcoin]
    );
    const deps = {
      db: nocturneDB,
      handlerContract,
      merkle: merkleProver,
      viewer: signer,
      gasAssets: testGasAssets,
      tokenConverter: new MockEthToTokenConverter(),
    };

    const provider = ethers.getDefaultProvider();
    const builder = newOpRequestBuilder(provider, 1n, DUMMY_CONFIG);
    const opRequest = await builder
      .__action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
      .__unwrap(shitcoin, 100_000n)
      .__refund({ asset: shitcoin, minRefundValue: 1n })
      .gas({
        executionGasLimit: 1_000_000n,
        gasPrice: 1n,
      })
      .deadline(1n)
      .build();

    const gasCompAccountedOpRequest = await handleGasForOperationRequest(
      deps,
      opRequest.request
    );

    expect(gasCompAccountedOpRequest.joinSplitRequests.length).to.eql(1);
    expect(gasCompAccountedOpRequest.gasPrice).to.eql(1n);
    expect(gasCompAccountedOpRequest.gasAsset).to.eql(shitcoin);

    const gasAccountedJoinSplitRequest =
      gasCompAccountedOpRequest.joinSplitRequests[0];
    expect(gasAccountedJoinSplitRequest.asset).to.eql(shitcoin);
    // exact amount depends
    expect(gasAccountedJoinSplitRequest.unwrapValue > 1_000_000).to.be.true;
  });

  it("adds a joinsplit request including gas comp when gas price is nonzero, there does not exist a joinsplit unwrapping a gasAsset, and user has enough of it", async () => {
    const [nocturneDB, merkleProver, signer, handlerContract] = await setup(
      [500_000n, 500_000n, 2_000_000n],
      [shitcoin, shitcoin, stablescam]
    );
    const deps = {
      db: nocturneDB,
      handlerContract,
      merkle: merkleProver,
      viewer: signer,
      gasAssets: testGasAssets,
      tokenConverter: new MockEthToTokenConverter(),
    };

    const provider = ethers.getDefaultProvider();
    const builder = newOpRequestBuilder(provider, 1n, DUMMY_CONFIG);
    const opRequest = await builder
      .__action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
      .__unwrap(shitcoin, 1_000_000n)
      .__refund({ asset: shitcoin, minRefundValue: 1n })
      .gas({
        executionGasLimit: 500_000n, // WTF
        gasPrice: 1n,
      })
      .deadline(1n)
      .build();

    const gasCompAccountedOpRequest = await handleGasForOperationRequest(
      deps,
      opRequest.request
    );

    const expectedJoinSplitRequestUnwrap: JoinSplitRequest = {
      asset: shitcoin,
      unwrapValue: 1_000_000n, // just the 1M requested in unwrap
    };

    expect(gasCompAccountedOpRequest.gasPrice).to.eql(1n);
    expect(gasCompAccountedOpRequest.gasAsset).to.eql(stablescam);

    expect(gasCompAccountedOpRequest.joinSplitRequests.length).to.eql(2);
    expect(gasCompAccountedOpRequest.joinSplitRequests[0]).to.eql(
      expectedJoinSplitRequestUnwrap
    );

    const joinSplitRequestForGas =
      gasCompAccountedOpRequest.joinSplitRequests[1];
    expect(joinSplitRequestForGas.asset).to.eql(stablescam);
    // exact amount depends
    expect(joinSplitRequestForGas.unwrapValue > 1_000_000).to.be.true;
  });

  it("adds a joinsplit request for gasAssetB when gas price is nonzero, there exists a joinsplit unwrapping gasAssetA, user doesn't have enough gasAssetA, but user does have enough gasAssetB", async () => {
    const [nocturneDB, merkleProver, signer, handlerContract] = await setup(
      [500_000n, 500_000n, 500_000n, 3_000_000n],
      [shitcoin, shitcoin, shitcoin, stablescam]
    );
    const deps = {
      handlerContract,
      merkle: merkleProver,
      viewer: signer,
      gasAssets: testGasAssets,
      tokenConverter: new MockEthToTokenConverter(),
      db: nocturneDB,
    };

    const provider = ethers.getDefaultProvider();
    const builder = newOpRequestBuilder(provider, 1n, DUMMY_CONFIG);
    const opRequest = await builder
      .__action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
      .__unwrap(shitcoin, 100_000n)
      .__refund({ asset: shitcoin, minRefundValue: 1n })
      .gas({
        // Exceeds shitcoin balance, forces us to use stablescam
        executionGasLimit: 1_500_000n,
        gasPrice: 1n,
      })
      .deadline(1n)
      .build();

    const gasCompAccountedOperationRequest = await handleGasForOperationRequest(
      deps,
      opRequest.request
    );

    expect(gasCompAccountedOperationRequest.gasPrice).to.eql(1n);
    expect(gasCompAccountedOperationRequest.joinSplitRequests.length).to.equal(
      2
    );
    expect(gasCompAccountedOperationRequest.gasAsset).to.eql(stablescam);

    const joinSplitRequestForOp =
      gasCompAccountedOperationRequest.joinSplitRequests[0];
    expect(joinSplitRequestForOp.asset).to.eql(shitcoin);
    expect(joinSplitRequestForOp.unwrapValue).to.eql(100_000n);

    const joinSplitRequestForGas =
      gasCompAccountedOperationRequest.joinSplitRequests[1];
    expect(joinSplitRequestForGas.asset).to.eql(stablescam);
    // exact amount depends
    expect(joinSplitRequestForGas.unwrapValue >= 1_000_000).to.be.true;
  });

  it("adds multiple joinsplit requests when gas compensation is high due to high gas price", async () => {
    const [nocturneDB, merkleProver, signer, handlerContract] = await setup(
      [
        500_000n,
        500_000n,
        2_000_000n,
        2_000_000n,
        2_000_000n,
        2_000_000n,
        2_000_000n,
        2_000_000n,
        2_000_000n,
        2_000_000n,
        2_000_000n,
        2_000_000n,
        2_000_000n,
        2_000_000n,
        2_000_000n,
        2_000_000n,
      ],
      [
        shitcoin,
        shitcoin,
        shitcoin,
        shitcoin,
        shitcoin,
        shitcoin,
        shitcoin,
        shitcoin,
        shitcoin,
        shitcoin,
        shitcoin,
        shitcoin,
        shitcoin,
        shitcoin,
        shitcoin,
        shitcoin,
      ]
    );
    const deps = {
      db: nocturneDB,
      handlerContract,
      merkle: merkleProver,
      viewer: signer,
      gasAssets: testGasAssets,
      tokenConverter: new MockEthToTokenConverter(),
    };

    const provider = ethers.getDefaultProvider();
    const builder = newOpRequestBuilder(provider, 1n, DUMMY_CONFIG);

    // Need 1M tokens to unwrap + op gas estimate (860k * 10)
    // 8.6M needed for gas incurs 3 more joinsplits (485k * 3 * 10)
    const opRequest = await builder
      .__action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
      .__unwrap(shitcoin, 1_000_000n)
      .__refund({ asset: shitcoin, minRefundValue: 1n })
      .gas({
        executionGasLimit: 1n,
        gasPrice: 10n,
      })
      .deadline(1n)
      .build();

    const gasCompAccountedOpRequest = await handleGasForOperationRequest(
      deps,
      opRequest.request
    );

    expect(gasCompAccountedOpRequest.gasPrice).to.eql(10n);
    expect(gasCompAccountedOpRequest.gasAsset).to.eql(shitcoin);

    expect(
      gasCompAccountedOpRequest.joinSplitRequests[0].unwrapValue >
        1_000_000n + 3n * maxGasForAdditionalJoinSplit()
    ).to.be.true;
  });
});
