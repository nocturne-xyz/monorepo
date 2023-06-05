import "mocha";
import {
  DUMMY_CONTRACT_ADDR,
  getDummyHex,
  setup,
  shitcoin,
  testGasAssets,
} from "./utils";
import { MockEthToTokenConverter, OperationRequestBuilder } from "../src";
import { handleGasForOperationRequest } from "../src/opRequestGas";
import { prepareOperation } from "../src/prepareOperation";
import { getCreationTimestampOfNewestNoteInOp } from "../src/timestampOfNewestNoteInOp";
import { expect } from "chai";

describe("getCreationTimestampOfNewestNoteInOp", () => {
  it("returns the timetsamp of the newest note in op", async () => {
    // setup with some tokens and timestamps
    const [nocturneDB, merkleProver, signer, handlerContract] = await setup(
      [100n, 10n, 20n, 1000n],
      [shitcoin, shitcoin, shitcoin, shitcoin],
      {
        timestamps: [1000, 2000, 3000, 4000],
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
    const builder = new OperationRequestBuilder();
    const opRequest = builder
      .action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
      .unwrap(shitcoin, 130n)
      .refundAsset(shitcoin)
      .maxNumRefunds(1n)
      .gas({
        executionGasLimit: 1_000_000n,
        gasPrice: 0n,
      })
      .chainId(1n)
      .deadline(1n)
      .build();

    // prepare the op
    // we expect the op to use the first 3 notes only
    const gasAccountedOpRequest = await handleGasForOperationRequest(
      deps,
      opRequest
    );
    const op = await prepareOperation(deps, gasAccountedOpRequest);

    // get timestamp
    const timestamp = await getCreationTimestampOfNewestNoteInOp(
      nocturneDB,
      op
    );

    // we expect it to be 3000, the timestamp of the to 20 token note which we expect should be the
    // newest note in the op
    expect(timestamp).to.equal(3000);
  });
});
