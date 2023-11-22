import { expect } from "chai";
import { ethers } from "ethers";
import "mocha";
import { MockEthToTokenConverter, newOpRequestBuilder } from "../src";
import { getTotalEntityIndexOfNewestNoteInOp } from "../src/NocturneClient";
import { handleGasForOperationRequest } from "../src/opRequestGas";
import { prepareOperation } from "../src/prepareOperation";
import {
  DUMMY_CONFIG,
  DUMMY_CONTRACT_ADDR,
  getDummyHex,
  setup,
  shitcoin,
  testGasAssets,
} from "./utils";

describe("getCreationTimestampOfNewestNoteInOp", () => {
  it("returns the timetsamp of the newest note in op", async () => {
    // setup with some tokens and totalEntityindices
    const [state, merkleProver, signer, handlerContract] = setup(
      [100n, 10n, 20n, 1000n],
      [shitcoin, shitcoin, shitcoin, shitcoin],
      {
        totalEntityIndices: [1000n, 2000n, 3000n, 4000n],
      }
    );

    // create an op request
    const deps = {
      handlerContract,
      merkle: merkleProver,
      viewer: signer,
      gasAssets: testGasAssets,
      tokenConverter: new MockEthToTokenConverter(),
      state,
    };
    const provider =
      ethers.getDefaultProvider() as ethers.providers.JsonRpcProvider;
    const builder = newOpRequestBuilder(provider, 1n, DUMMY_CONFIG);
    const opRequest = await builder
      .__action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
      .__unwrap(shitcoin, 130n)
      .__refund({ asset: shitcoin, minRefundValue: 1n })
      .gas({
        executionGasLimit: 1_000_000n,
        gasPrice: 0n,
      })
      .deadline(1n)
      .build();

    // prepare the op
    // we expect the op to use the first 3 notes only
    const gasAccountedOpRequest = await handleGasForOperationRequest(
      deps,
      opRequest.request,
      1
    );
    const op = prepareOperation(deps, gasAccountedOpRequest);

    // get totalEntityIndex of the newest note in the op
    const totalEntityindex = getTotalEntityIndexOfNewestNoteInOp(
      state,
      op
    );

    // we expect it to be 4000, the totalEntityIndex of the to 1000 token note which we expect should be the
    // newest note in the op due to even number padding.
    expect(totalEntityindex).to.equal(4000n);
  });
});
