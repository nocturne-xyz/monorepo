import "mocha";
import { expect } from "chai";
import {
  NocturneSigner,
  NocturneSignature,
  generateRandomSpendingKey,
} from "@nocturne-xyz/primitives";
import { shitcoin, setup, getDummyHex } from "./utils";
import { OperationRequestBuilder, OpSigner, OpPreparer } from "../src";

describe("OpSigner", () => {
  it("signs an operation with 1 action, 1 unwrap, 1 payment", async () => {
    const [notesDB, merkleProver, signer, walletContract] = await setup(
      [100n, 10n],
      [shitcoin, shitcoin]
    );
    const preparer = new OpPreparer(
      notesDB,
      merkleProver,
      signer,
      walletContract
    );
    const opSigner = new OpSigner(signer);

    const receiverSk = generateRandomSpendingKey();
    const receiverSigner = new NocturneSigner(receiverSk);
    const receiver = receiverSigner.canonicalAddress();

    // make operation request and prepare it
    const builder = new OperationRequestBuilder();
    const opRequest = builder
      .action("0x1234", getDummyHex(0))
      .unwrap(shitcoin, 3n)
      .refundAsset(shitcoin)
      .confidentialPayment(shitcoin, 1n, receiver)
      .gas({
        executionGasLimit: 1_000_000n,
        gasPrice: 1n,
      })
      .build();
    const op = await preparer.prepareOperation(opRequest);

    // attempt to sign it
    // expect it to not fail, and to have a valid signature
    const signed = opSigner.signOperation(op);
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
