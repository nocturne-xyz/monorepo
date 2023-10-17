import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { setupTestDeployment, setupTestClient } from "../src/deploy";
import { ethers } from "ethers";
import { DepositManager } from "@nocturne-xyz/contracts";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import {
  Asset,
  NocturneSigner,
  unzip,
  hashDepositRequest,
} from "@nocturne-xyz/core";
import { queryDepositStatus } from "../src/utils";
import { depositFundsSingleToken } from "../src/deposit";

chai.use(chaiAsPromised);

describe("screener", async () => {
  let teardown: () => Promise<void>;

  let provider: ethers.providers.JsonRpcProvider;
  let aliceEoa: ethers.Wallet;

  let depositManager: DepositManager;
  let nocturneSignerAlice: NocturneSigner;

  let erc20: SimpleERC20Token;
  let erc20Asset: Asset;

  beforeEach(async () => {
    const testDeployment = await setupTestDeployment({
      include: {
        subgraph: true,
        depositScreener: true,
      },
    });

    ({ provider, teardown, aliceEoa, depositManager } = testDeployment);

    ({ erc20, erc20Asset } = testDeployment.tokens);

    ({ nocturneSignerAlice } = await setupTestClient(
      testDeployment.config,
      provider,
      {
        gasAssets: new Map([["GAS", erc20Asset.assetAddr]]),
      }
    ));
  });

  afterEach(async () => {
    await teardown();
  });

  it("ignores deposits without gas compensation attached", async () => {
    console.log("deposit some tokens with no gas compensation");
    const [requests] = unzip(
      await depositFundsSingleToken(
        depositManager,
        erc20,
        aliceEoa,
        nocturneSignerAlice.generateRandomStealthAddress(),
        [100n],
        true,
        // 0 gas comp
        0n
      )
    );

    expect(requests.length).to.equal(1);

    const req = requests[0];
    const status = await queryDepositStatus(hashDepositRequest(req));
    expect(status).to.not.be.undefined;
    expect(status?.status).to.eql("DoesNotExist");
  });
});
