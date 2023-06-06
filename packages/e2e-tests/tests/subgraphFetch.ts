// import { DepositEventType, fetchDepositEvents } from "@nocturne-xyz/sdk";
import { DepositManager } from "@nocturne-xyz/contracts";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import {
  Asset,
  NocturneWalletSDK,
  StealthAddressTrait,
  fetchDepositEvents,
} from "@nocturne-xyz/sdk";
import { expect } from "chai";
import { ethers } from "ethers";
import { setupTestClient, setupTestDeployment } from "../src/deploy";
import { depositFundsSingleToken } from "../src/deposit";
import { GAS_FAUCET_DEFAULT_AMOUNT } from "../src/utils";

describe("Fetching Deposit Events", function () {
  let teardown: () => Promise<void>;
  let provider: ethers.providers.Provider;
  let depositManager: DepositManager;
  let gasToken: SimpleERC20Token;
  let nocturneWalletSDKAlice: NocturneWalletSDK;
  let nocturneWalletSDKBob: NocturneWalletSDK;
  let aliceEoa: ethers.Wallet;
  let bobEoa: ethers.Wallet;
  let subgraphUrl: string;
  let gasTokenAsset: Asset;

  beforeEach(async () => {
    const testDeployment = await setupTestDeployment({
      include: {
        subgraph: true,
      },
    });

    ({ teardown, provider, aliceEoa, bobEoa, subgraphUrl, depositManager } =
      testDeployment);
    ({ gasToken, gasTokenAsset } = testDeployment.tokens);
    ({ nocturneWalletSDKAlice, nocturneWalletSDKBob } = await setupTestClient(
      testDeployment.config,
      provider,
      {
        gasAssets: new Map([["GAS", gasTokenAsset.assetAddr]]),
      }
    ));
  });

  afterEach(async () => {
    await teardown();
  });

  it("Should fetch all deposit events, with no query conditional params specified", async () => {
    await depositFundsSingleToken(
      depositManager,
      gasToken,
      aliceEoa,
      nocturneWalletSDKAlice.signer.canonicalStealthAddress(),
      [GAS_FAUCET_DEFAULT_AMOUNT],
      false
    );

    await depositFundsSingleToken(
      depositManager,
      gasToken,
      bobEoa,
      nocturneWalletSDKBob.signer.canonicalStealthAddress(),
      [GAS_FAUCET_DEFAULT_AMOUNT],
      false
    );

    // Both deposits should be returned—no filter specified
    const result = await fetchDepositEvents(subgraphUrl);
    console.log("fetchDepositEvents", result);
    expect(result.length).to.be.equal(2);
    expect(result[0]?.depositAddr).to.be.equal(
      StealthAddressTrait.compress(
        nocturneWalletSDKAlice.signer.canonicalStealthAddress()
      )
    );
    expect(result[1]?.depositAddr).to.be.equal(
      StealthAddressTrait.compress(
        nocturneWalletSDKAlice.signer.canonicalStealthAddress()
      )
    );

    // Filter by spender—Only Alice's deposit should be returned
    const aliceQueryResult = await fetchDepositEvents(subgraphUrl, {
      spender: aliceEoa.address,
    });

    expect(aliceQueryResult.length).to.be.equal(1);
    expect(aliceQueryResult[0]?.depositAddr).to.be.equal(
      StealthAddressTrait.compress(
        nocturneWalletSDKAlice.signer.canonicalStealthAddress()
      )
    );
  });
});
