import "mocha";
import { expect } from "chai";
import {
  NocturneSigner,
  NocturneSignature,
  StealthAddressTrait,
  encryptNote,
  generateRandomSigningKey,
} from "../src/crypto";
import { shitcoin, setup, getDummyHex } from "./utils";
import {
  OperationRequestBuilder,
  AssetTrait,
  AssetType,
  prepareOperation,
} from "../src";

describe("NocturneSigner", () => {
  it("View key should work", () => {
    const sk1 = generateRandomSigningKey();
    const sk2 = generateRandomSigningKey();
    const signer1 = new NocturneSigner(sk1);
    const signer2 = new NocturneSigner(sk2);
    expect(
      signer1.isOwnAddress(signer1.generateRandomStealthAddress())
    ).to.equal(true);
    expect(
      signer1.isOwnAddress(signer2.generateRandomStealthAddress())
    ).to.equal(false);
    expect(
      signer2.isOwnAddress(signer2.generateRandomStealthAddress())
    ).to.equal(true);
    expect(
      signer2.isOwnAddress(signer1.generateRandomStealthAddress())
    ).to.equal(false);
  });

  it("Test rerand", () => {
    const sk1 = generateRandomSigningKey();
    const sk2 = generateRandomSigningKey();
    const signer1 = new NocturneSigner(sk1);
    const signer2 = new NocturneSigner(sk2);

    const addr1 = signer1.generateRandomStealthAddress();
    const addr2 = StealthAddressTrait.randomize(addr1);

    expect(signer1.isOwnAddress(addr1)).to.equal(true);
    expect(signer1.isOwnAddress(addr2)).to.equal(true);
    expect(signer2.isOwnAddress(addr1)).to.equal(false);
    expect(signer2.isOwnAddress(addr2)).to.equal(false);
  });

  it("Test address (de)serialization", () => {
    const sk = generateRandomSigningKey();
    const signer = new NocturneSigner(sk);
    const addr = signer.generateRandomStealthAddress();
    const str = StealthAddressTrait.toString(addr);
    expect(StealthAddressTrait.fromString(str)).to.eql(addr);
  });

  it("Test Sign / verify", () => {
    const sk = generateRandomSigningKey();
    const signer = new NocturneSigner(sk);
    const pk = signer.spendPk;
    const m = 123n;
    const sig = signer.sign(m);
    expect(NocturneSigner.verify(pk, m, sig)).to.equal(true);
  });

  it("Test note transmission", () => {
    const sk = generateRandomSigningKey();
    const signer = new NocturneSigner(sk);
    const addr = signer.canonicalAddress();
    const asset = {
      assetType: AssetType.ERC20,
      assetAddr: "0x123",
      id: 1n,
    };
    const note = {
      owner: signer.generateRandomStealthAddress(),
      nonce: 33n,
      value: 55n,
      asset,
    };
    const encryptedNote = encryptNote(addr, note);
    const note2 = signer.getNoteFromEncryptedNote(encryptedNote, 2, asset);
    expect(note.nonce).to.equal(note2.nonce);
    expect(note.value).to.equal(note2.value);
  });

  it("Test asset and id encoding with small id", async () => {
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

  it("Test asset and id encoding with big id", async () => {
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

  it("signs an operation with 1 action, 1 unwrap, 1 payment", async () => {
    const [notesDB, merkleProver, signer, walletContract] = await setup(
      [100n, 10n],
      [shitcoin, shitcoin]
    );

    const receiverSk = generateRandomSigningKey();
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
        verificationGasLimit: 1_000_000n,
        executionGasLimit: 1_000_000n,
        gasPrice: 1n,
      })
      .build();
    const op = await prepareOperation(
      opRequest,
      notesDB,
      merkleProver,
      signer,
      walletContract
    );

    // attempt to sign it
    // expect it to not fail, and to have a valid signature
    const signed = signer.signOperation(op);
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
