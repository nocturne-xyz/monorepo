import "mocha";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { expect } from "chai";
import { Asset, AssetType, OperationRequestBuilder } from "../src";
import { OpPreparer } from "../src/opPreparer";
import {
  setup,
  shitcoin,
  getDummyHex,
  testGasAssets,
  stablescam,
} from "./utils";
import { handleGasForOperationRequest } from "../src/opRequestGas";
import { ERC20_ID } from "../src/primitives/asset";
import { JoinSplitRequest } from "../src/operationRequest";

chai.use(chaiAsPromised);

const DUMMY_GAS_ASSET: Asset = {
  assetType: AssetType.ERC20,
  assetAddr: "0x0000000000000000000000000000000000000000",
  id: ERC20_ID,
};

describe("prepareOperationRequest", async () => {
  it("Has gas price 0 and dummy asset when opRequest gasPrice = 0", async () => {
    const [nocturneDB, merkleProver, signer, walletContract] = await setup(
      [500_000n, 500_000n],
      [shitcoin, shitcoin]
    );
    const opPreparer = new OpPreparer(nocturneDB, merkleProver, signer);
    const deps = {
      db: nocturneDB,
      walletContract,
      gasAssets: testGasAssets,
      opPreparer,
    };

    const builder = new OperationRequestBuilder();
    const opRequest = builder
      .action("0x1234", getDummyHex(0))
      .unwrap(shitcoin, 3n)
      .refundAsset(shitcoin)
      .maxNumRefunds(1n)
      .gas({
        executionGasLimit: 1_000_000n,
        gasPrice: 0n,
      })
      .build();

    const gasCompAccountedOpRequest = await handleGasForOperationRequest(
      deps,
      opRequest
    );

    expect(gasCompAccountedOpRequest.gasPrice).to.eql(0n);
    expect(gasCompAccountedOpRequest.gasAsset).to.eql(DUMMY_GAS_ASSET);
  });

  it("Accounts for gas asset when gasPrice > 0, same asset as joinsplit request", async () => {
    const [nocturneDB, merkleProver, signer, walletContract] = await setup(
      [500_000n, 500_000n, 500_000n],
      [shitcoin, shitcoin, shitcoin]
    );
    const opPreparer = new OpPreparer(nocturneDB, merkleProver, signer);
    const deps = {
      db: nocturneDB,
      walletContract,
      gasAssets: testGasAssets,
      opPreparer,
    };

    const builder = new OperationRequestBuilder();
    const opRequest = builder
      .action("0x1234", getDummyHex(0))
      .unwrap(shitcoin, 100_000n)
      .refundAsset(shitcoin)
      .maxNumRefunds(1n)
      .gas({
        executionGasLimit: 1_000_000n,
        gasPrice: 1n,
      })
      .build();

    const gasCompAccountedOpRequest = await handleGasForOperationRequest(
      deps,
      opRequest
    );

    const expectedJoinSplitRequest: JoinSplitRequest = {
      asset: shitcoin,
      unwrapValue: 1_350_000n, // 1M + 100k + 250k (250k is joinsplit + refund gas)
    };

    expect(gasCompAccountedOpRequest.joinSplitRequests.length).to.eql(1);
    expect(gasCompAccountedOpRequest.joinSplitRequests[0]).to.eql(
      expectedJoinSplitRequest
    );
    expect(gasCompAccountedOpRequest.gasPrice).to.eql(1n);
    expect(gasCompAccountedOpRequest.gasAsset).to.eql(shitcoin);
  });

  it("Accounts for gas asset when gasPrice > 0, different joinsplit request for gas comp", async () => {
    const [nocturneDB, merkleProver, signer, walletContract] = await setup(
      [500_000n, 500_000n, 2_000_000n],
      [shitcoin, shitcoin, stablescam]
    );
    const opPreparer = new OpPreparer(nocturneDB, merkleProver, signer);
    const deps = {
      db: nocturneDB,
      walletContract,
      gasAssets: testGasAssets,
      opPreparer,
    };

    const builder = new OperationRequestBuilder();
    const opRequest = builder
      .action("0x1234", getDummyHex(0))
      .unwrap(shitcoin, 1_000_000n)
      .refundAsset(shitcoin)
      .maxNumRefunds(1n)
      .gas({
        executionGasLimit: 1_000_000n,
        gasPrice: 1n,
      })
      .build();

    const gasCompAccountedOpRequest = await handleGasForOperationRequest(
      deps,
      opRequest
    );

    const expectedJoinSplitRequestUnwrap: JoinSplitRequest = {
      asset: shitcoin,
      unwrapValue: 1_000_000n, // just the 1M requested in unwrap
    };
    const expectedJoinSplitRequestGas: JoinSplitRequest = {
      asset: stablescam,
      unwrapValue: 1_250_000n, // just the 1M requested in unwrap
    };

    expect(gasCompAccountedOpRequest.joinSplitRequests.length).to.eql(2);
    expect(gasCompAccountedOpRequest.joinSplitRequests[0]).to.eql(
      expectedJoinSplitRequestUnwrap
    );
    expect(gasCompAccountedOpRequest.joinSplitRequests[1]).to.eql(
      expectedJoinSplitRequestGas
    );
    expect(gasCompAccountedOpRequest.gasPrice).to.eql(1n);
    expect(gasCompAccountedOpRequest.gasAsset).to.eql(stablescam);
  });
});
