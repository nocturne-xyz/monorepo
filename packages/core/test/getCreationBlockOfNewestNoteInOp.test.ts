import "mocha";
import { ethers } from "ethers";
import {
  DUMMY_CONTRACT_ADDR,
  getDummyHex,
  setup,
  shitcoin,
  testGasAssets,
} from "./utils";
import { MockEthToTokenConverter, newOpRequestBuilder } from "../src";
import { handleGasForOperationRequest } from "../src/opRequestGas";
import { prepareOperation } from "../src/prepareOperation";
import { expect } from "chai";
import { getTotalEntityIndexOfNewestNoteInOp } from "../src/totalEntityIndexOfNewestNoteInOp";

describe("getCreationTimestampOfNewestNoteInOp", () => {
  it("returns the timetsamp of the newest note in op", async () => {
    // setup with some tokens and totalEntityindices
    const [nocturneDB, merkleProver, signer, handlerContract] = await setup(
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
      db: nocturneDB,
    };
    const provider = ethers.getDefaultProvider();
    const builder = newOpRequestBuilder(provider, 1n, DUMMY_CONTRACT_ADDR);
    const opRequest = await builder
      .action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
      .unwrap(shitcoin, 130n)
      .refundAsset(shitcoin)
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
      opRequest.request
    );
    const op = await prepareOperation(deps, gasAccountedOpRequest);

    // get totalEntityIndex of the newest note in the op
    const totalEntityindex = await getTotalEntityIndexOfNewestNoteInOp(
      nocturneDB,
      op
    );

    // we expect it to be 3000, the totalEntityIndex of the to 20 token note which we expect should be the
    // newest note in the op
    expect(totalEntityindex).to.equal(3000n);
  });
});
