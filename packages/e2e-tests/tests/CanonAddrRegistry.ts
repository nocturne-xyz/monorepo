import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { setupTestDeployment, setupTestClient } from "../src/deploy";
import { ethers } from "ethers";
import { CanonicalAddressRegistry } from "@nocturne-xyz/contracts";
import {
  Asset,
  NocturneSigner,
  compressPoint,
  computeCanonAddrRegistryEntryDigest,
  packToSolidityProof,
} from "@nocturne-xyz/core";
import { CanonAddrSigCheckInputs } from "@nocturne-xyz/core";
import { CanonAddrSigCheckProver } from "@nocturne-xyz/core";

chai.use(chaiAsPromised);

describe("Canonical Address Registry", async () => {
  let teardown: () => Promise<void>;

  let provider: ethers.providers.JsonRpcProvider;
  let aliceEoa: ethers.Wallet;
  let bobEoa: ethers.Wallet;

  let canonAddrRegistry: CanonicalAddressRegistry;
  let nocturneSignerAlice: NocturneSigner;
  let nocturneSignerBob: NocturneSigner;

  let canonAddrSigCheckProver: CanonAddrSigCheckProver;

  let gasTokenAsset: Asset;

  beforeEach(async () => {
    const testDeployment = await setupTestDeployment({
      include: {
        bundler: false,
        subtreeUpdater: false,
        subgraph: false,
        depositScreener: false,
      },
    });

    ({ provider, teardown, canonAddrRegistry, aliceEoa, bobEoa } =
      testDeployment);

    ({ gasTokenAsset } = testDeployment.tokens);

    ({ nocturneSignerAlice, nocturneSignerBob, canonAddrSigCheckProver } =
      await setupTestClient(testDeployment.config, provider, {
        gasAssets: new Map([["GAS", gasTokenAsset.assetAddr]]),
      }));
  });

  afterEach(async () => {
    await teardown();
  });

  it("generates sig proof and registers canon addr", async () => {
    bobEoa;
    nocturneSignerBob;

    console.log("formatting proof inputs...");

    const aliceCanonAddr = nocturneSignerAlice.canonicalAddress();
    const aliceCanonAddrCompressed = compressPoint(aliceCanonAddr);
    const nonce = await canonAddrRegistry._compressedCanonAddrToNonce(
      aliceCanonAddrCompressed
    );

    const digest = computeCanonAddrRegistryEntryDigest(
      {
        ethAddress: aliceEoa.address,
        perCanonAddrNonce: nonce.toBigInt(),
      },
      31337n,
      canonAddrRegistry.address
    );
    const sig = nocturneSignerAlice.sign(digest);

    const spendPubKey = nocturneSignerAlice.spendPk;
    const vkNonce = nocturneSignerAlice.vkNonce;

    const proofInputs: CanonAddrSigCheckInputs = {
      canonAddr: aliceCanonAddr,
      msg: digest,
      sig,
      spendPubkey: spendPubKey,
      vkNonce,
    };

    const { proof } = await canonAddrSigCheckProver.proveCanonAddrSigCheck(
      proofInputs
    );

    console.log("submitting call...");
    const tx = await canonAddrRegistry
      .connect(aliceEoa)
      .setCanonAddr(aliceCanonAddrCompressed, packToSolidityProof(proof));
    console.log("tx hash: ", tx.hash);
  });
});
