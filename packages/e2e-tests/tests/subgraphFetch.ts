import { DepositManager } from "@nocturne-xyz/contracts";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import {
  Asset,
  NocturneWalletSDK,
  StealthAddressTrait,
  fetchDepositEvents,
  sleep,
} from "@nocturne-xyz/sdk";
import { ethers } from "ethers";
import {
  SUBGRAPH_URL,
  setupTestClient,
  setupTestDeployment,
} from "../src/deploy";
import { depositFundsSingleToken } from "../src/deposit";
import { GAS_FAUCET_DEFAULT_AMOUNT } from "../src/utils";
import { expect } from "chai";

describe("Fetching Deposit Events", function () {
  let teardown: () => Promise<void>;
  let provider: ethers.providers.Provider;
  let depositManager: DepositManager;
  let gasToken: SimpleERC20Token;
  let nocturneWalletSDKAlice: NocturneWalletSDK;
  let nocturneWalletSDKBob: NocturneWalletSDK;
  let aliceEoa: ethers.Wallet;
  let bobEoa: ethers.Wallet;
  let gasTokenAsset: Asset;

  beforeEach(async () => {
    const testDeployment = await setupTestDeployment({
      include: {
        subgraph: true,
      },
    });

    ({ teardown, provider, aliceEoa, bobEoa, depositManager } = testDeployment);
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
    const aliceStealthAddr =
      nocturneWalletSDKAlice.signer.canonicalStealthAddress();
    const bobStealthAddr =
      nocturneWalletSDKBob.signer.canonicalStealthAddress();

    await depositFundsSingleToken(
      depositManager,
      gasToken,
      aliceEoa,
      aliceStealthAddr,
      [GAS_FAUCET_DEFAULT_AMOUNT, GAS_FAUCET_DEFAULT_AMOUNT],
      false
    );

    await depositFundsSingleToken(
      depositManager,
      gasToken,
      bobEoa,
      bobStealthAddr,
      [GAS_FAUCET_DEFAULT_AMOUNT],
      false
    );

    await sleep(10_000);

    // Both deposits should be returned—no filter specified
    let withEntityIndex = await fetchDepositEvents(SUBGRAPH_URL);
    const result = withEntityIndex.map((x) => x.inner);
    console.log("fetchDepositEvents", result);

    expect(result.length).to.eql(3);
    expect(result[0]?.depositAddr).to.eql(
      StealthAddressTrait.compress(aliceStealthAddr)
    );
    expect(result[1]?.depositAddr).to.eql(
      StealthAddressTrait.compress(aliceStealthAddr)
    );
    expect(result[2]?.depositAddr).to.eql(
      StealthAddressTrait.compress(bobStealthAddr)
    );
    // Filter by spender—Only Alice's deposit should be returned
    withEntityIndex = await fetchDepositEvents(SUBGRAPH_URL, {
      spender: aliceEoa.address,
    });
    const aliceQueryResult = withEntityIndex.map((x) => x.inner);

    expect(aliceQueryResult.length).to.eql(2);
    expect(aliceQueryResult[0]?.depositAddr).to.eql(
      StealthAddressTrait.compress(aliceStealthAddr)
    );
    expect(result[1]?.depositAddr).to.eql(
      StealthAddressTrait.compress(aliceStealthAddr)
    );
  });
});
