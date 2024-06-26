import {
  Asset,
  AssetType,
  ERC20_ID,
  gasCompensationForParams,
} from "@nocturne-xyz/core";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers } from "ethers";
import "mocha";
import { newOpRequestBuilder } from "../src";
import { MockEthToTokenConverter } from "../src/conversion";
import { handleGasForOperationRequest } from "../src/opRequestGas";
import { JoinSplitRequest } from "../src/operationRequest/operationRequest";
import {
  DUMMY_CONFIG,
  DUMMY_CONTRACT_ADDR,
  getDummyHex,
  setup,
  shitcoin,
  stablescam,
  testGasAssets,
} from "./utils";

chai.use(chaiAsPromised);

const DUMMY_GAS_ASSET: Asset = {
  assetType: AssetType.ERC20,
  assetAddr: "0x0000000000000000000000000000000000000000",
  id: ERC20_ID,
};

const gasMultiplier = 1;

describe("handleGasForOperationRequest", async () => {
  let provider: ethers.providers.JsonRpcProvider;
  beforeEach(() => {
    provider = ethers.getDefaultProvider() as ethers.providers.JsonRpcProvider;
  });

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
      opRequest.request,
      gasMultiplier
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
      opRequest.request,
      gasMultiplier
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
      [500_000n, 500_000n, 3_000_000n],
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
      opRequest.request,
      gasMultiplier
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
      [500_000n, 500_000n, 500_000n, 4_000_000n],
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
      opRequest.request,
      gasMultiplier
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

  it("accounts for gas of 3 extra joinsplits when gas compensation is high", async () => {
    const [nocturneDB, merkleProver, signer, handlerContract] = await setup(
      [
        500_000n, // for execution
        500_000n, // for execution
        1_500_000n, // for base gas (op w/ 1 JS)
        1_500_000n, // for base gas (op w/ 1 JS)
        1_500_000n, // for base gas (op w/ 1 JS)
        1_500_000n, // for base gas (op w/ 1 JS)
        1_500_000n, // for base gas (op w/ 1 JS)
        2_000_000n, // rest is for covering extra joinsplits cost
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

    const builder = newOpRequestBuilder(provider, 1n, DUMMY_CONFIG);

    // Need 1M tokens to unwrap + op gas estimate with 1 JS (485k for one JS + 200k for op and gas buffer)
    // 685k * 10 = 6.85M tokens needed for 1 JS op gas
    // Each note of gas token is 1.5M so we need 6 notes, 3 additional JSs to cover (doesn't
    // including extras to cover those joinsplits)
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
      opRequest.request,
      gasMultiplier
    );

    expect(gasCompAccountedOpRequest.gasPrice).to.eql(10n);
    expect(gasCompAccountedOpRequest.gasAsset).to.eql(shitcoin);

    // Has enough for 1 original joinsplit + 3 additional gas joinsplits (4 total)
    const expectedGasCompForOperation = gasCompensationForParams({
      executionGasLimit: 1n,
      numJoinSplits: 4,
      numUniqueAssets: 1,
    });
    expect(
      gasCompAccountedOpRequest.joinSplitRequests[0].unwrapValue >
        1_000_000n + expectedGasCompForOperation * 10n
    ).to.be.true;
  });

  it("detects when existing joinsplit can account for all gas comp needed and does not add new joinsplits for gas", async () => {
    const [nocturneDB, merkleProver, signer, handlerContract] = await setup(
      [100_000_000n],
      [shitcoin]
    );
    const deps = {
      db: nocturneDB,
      handlerContract,
      merkle: merkleProver,
      viewer: signer,
      gasAssets: testGasAssets,
      tokenConverter: new MockEthToTokenConverter(),
    };

    const builder = newOpRequestBuilder(provider, 1n, DUMMY_CONFIG);

    // Need 1M tokens to unwrap + op gas estimate with 1 joinsplit (860k * 10)
    // 860k * 10 = 8.6M needed for gas but can all be handled by the big 100M note
    const opRequest = await builder
      .__action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
      .__unwrap(shitcoin, 1_000_000n)
      .gas({
        executionGasLimit: 1n,
        gasPrice: 10n,
      })
      .deadline(1n)
      .build();

    const gasCompAccountedOpRequest = await handleGasForOperationRequest(
      deps,
      opRequest.request,
      gasMultiplier
    );

    expect(gasCompAccountedOpRequest.gasPrice).to.eql(10n);
    expect(gasCompAccountedOpRequest.gasAsset).to.eql(shitcoin);

    const expectedGasCompForOperation = gasCompensationForParams({
      executionGasLimit: 1n,
      numJoinSplits: 1,
      numUniqueAssets: 1,
    });

    // Expect total amount unwrapped in joinsplit to be unwrap value + gas comp assuming 1 joinsplit (no extras added)
    expect(gasCompAccountedOpRequest.joinSplitRequests[0].unwrapValue).to.eql(
      1_000_000n + expectedGasCompForOperation * 10n
    );
  });
});
