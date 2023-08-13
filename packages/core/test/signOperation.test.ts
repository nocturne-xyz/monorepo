import "mocha";
import { expect } from "chai";
import {
  NocturneSigner,
  NocturneSignature,
  generateRandomSpendingKey,
} from "../src/crypto";
import {
  shitcoin,
  setup,
  getDummyHex,
  testGasAssets,
  DUMMY_CONTRACT_ADDR,
} from "./utils";
import { OperationRequestBuilder } from "../src";
import { prepareOperation } from "../src/prepareOperation";
import { handleGasForOperationRequest } from "../src/opRequestGas";
import { signOperation } from "../src/signOperation";
import { MockEthToTokenConverter } from "../src/conversion";

describe("signOperation", () => {
  it("signs an operation with 1 action, 1 unwrap, 1 payment", async () => {
    const [nocturneDB, merkleProver, signer, handlerContract] = await setup(
      [100n, 10n],
      [shitcoin, shitcoin]
    );
    const deps = {
      db: nocturneDB,
      gasAssets: testGasAssets,
      tokenConverter: new MockEthToTokenConverter(),
      merkle: merkleProver,
      viewer: signer,
      handlerContract,
    };

    const receiverRk = generateRandomSpendingKey();
    const receiverSigner = new NocturneSigner(receiverRk);
    const receiver = receiverSigner.canonicalAddress();

    // make operation request and prepare it
    const builder = new OperationRequestBuilder({
      chainId: 1n,
      tellerContract: DUMMY_CONTRACT_ADDR,
    });
    const opRequest = builder
      .action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
      .unwrap(shitcoin, 3n)
      .refundAsset(shitcoin)
      .confidentialPayment(shitcoin, 1n, receiver)
      .gas({
        executionGasLimit: 1_000_000n,
        gasPrice: 0n,
      })
      .deadline(1n)
      .build();

    const gasCompAccountedOperationRequest = await handleGasForOperationRequest(
      deps,
      opRequest.request
    );
    const op = await prepareOperation(deps, gasCompAccountedOperationRequest);

    // attempt to sign it
    // expect it to not fail, and to have a valid signature
    const signed = signOperation(signer, op);
    expect(signed).to.not.be.undefined;
    expect(signed).to.not.be.null;

    expect(signed.joinSplits.length).to.be.greaterThan(0);

    const joinSplit = signed.joinSplits[0];
    expect(joinSplit.proofInputs).to.not.be.undefined;
    expect(joinSplit.proofInputs).to.not.be.null;

    const c = joinSplit.proofInputs.c;
    expect(c).to.not.be.undefined;
    expect(c).to.not.be.null;

    const z = joinSplit.proofInputs.z;
    expect(z).to.not.be.undefined;
    expect(z).to.not.be.null;

    const opDigest = joinSplit.opDigest;
    expect(opDigest).to.not.be.undefined;
    expect(opDigest).to.not.be.null;

    const sig: NocturneSignature = { c, z };
    const pk = signer.spendPk;
    expect(NocturneSigner.verify(pk, opDigest, sig)).to.equal(true);
  });
});
