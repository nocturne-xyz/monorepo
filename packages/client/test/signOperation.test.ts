import "mocha";
import { expect } from "chai";
import {
  NocturneSigner,
  NocturneSignature,
  generateRandomSpendingKey,
} from "@nocturne-xyz/crypto";
import {
  shitcoin,
  setup,
  getDummyHex,
  testGasAssets,
  DUMMY_CONTRACT_ADDR,
  DUMMY_CONFIG,
} from "./utils";
import { newOpRequestBuilder } from "../src";
import { prepareOperation } from "../src/prepareOperation";
import { handleGasForOperationRequest } from "../src/opRequestGas";
import { signOperation } from "../src/signOperation";
import { MockEthToTokenConverter } from "../src/conversion";
import { ethers } from "ethers";

const gasMultiplier = 1;
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
    const provider =
      ethers.getDefaultProvider() as ethers.providers.JsonRpcProvider;
    const builder = newOpRequestBuilder(provider, 1n, DUMMY_CONFIG);
    const opRequest = await builder
      .__action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
      .__unwrap(shitcoin, 3n)
      .__refund({ asset: shitcoin, minRefundValue: 1n })
      .confidentialPayment(shitcoin, 1n, receiver)
      .gas({
        executionGasLimit: 1_000_000n,
        gasPrice: 0n,
      })
      .deadline(1n)
      .build();

    const gasCompAccountedOperationRequest = await handleGasForOperationRequest(
      deps,
      opRequest.request,
      gasMultiplier
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
