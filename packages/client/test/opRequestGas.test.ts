import { gasCompensationForParams } from "@nocturne-xyz/core";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers } from "ethers";
import "mocha";
import { newOpRequestBuilder } from "../src";
import { MockEthToTokenConverter } from "../src/conversion";
import { handleGasForOperationRequest } from "../src/opRequestGas";
import { JoinSplitRequest } from "../src/operationRequest/operationRequest";
import {
  DUMMY_CONFIG,
  DUMMY_CONTRACT_ADDR,
  getDummyHex,
  ponzi,
  setup,
  shitcoin,
  stablescam,
  testGasAssets,
} from "./utils";

chai.use(chaiAsPromised);

const gasMultiplier = 1;

describe("handleGasForOperationRequest", () => {
  let provider: ethers.providers.JsonRpcProvider;
  beforeEach(() => {
    provider = ethers.getDefaultProvider() as ethers.providers.JsonRpcProvider;
  });

  describe("satisfies gas costs with...", () => {
    it("gas price 0", async () => {
      const [nocturneDB, merkleProver, signer, handlerContract] = await setup(
        [500_000n, 500_000n],
        [shitcoin, shitcoin]
      );
      const deps = {
        db: nocturneDB,
        handlerContract,
        merkle: merkleProver,
        viewer: signer,
        gasAssets: testGasAssets(shitcoin),
        tokenConverter: new MockEthToTokenConverter(),
      };

      const builder = newOpRequestBuilder(provider, 1n, DUMMY_CONFIG);
      const opRequest = await builder
        .__action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
        .__unwrap(shitcoin, 3n)
        .__refund({ asset: shitcoin, minRefundValue: 1n })
        .gas({
          executionGasLimit: 1_000_000n,
          gasPrice: 0n,
        })
        .deadline(1n)
        .build();

      const gasCompAccountedOpRequest = await handleGasForOperationRequest(
        deps,
        opRequest.request,
        gasMultiplier
      );

      expect(gasCompAccountedOpRequest.gasPrice).to.eql(0n);
      expect(gasCompAccountedOpRequest.gasAsset).to.eql(shitcoin);
    });

    it("1 note in gas asset, does not cover, ∃ 1 other note > remainder", async () => {
      const [nocturneDB, merkleProver, signer, handlerContract] = await setup(
        [500_000n, 2_500_000n],
        [shitcoin, shitcoin]
      );
      const deps = {
        db: nocturneDB,
        handlerContract,
        merkle: merkleProver,
        viewer: signer,
        gasAssets: testGasAssets(shitcoin),
        tokenConverter: new MockEthToTokenConverter(),
      };

      const builder = newOpRequestBuilder(provider, 1n, DUMMY_CONFIG);
      const opRequest = await builder
        .__action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
        .__unwrap(shitcoin, 100_000n)
        .__refund({ asset: shitcoin, minRefundValue: 1n })
        .gas({
          executionGasLimit: 1_000_000n,
          gasPrice: 1n,
        })
        .deadline(1n)
        .build();

      const gasCompAccountedOpRequest = await handleGasForOperationRequest(
        deps,
        opRequest.request,
        gasMultiplier
      );

      expect(gasCompAccountedOpRequest.joinSplitRequests.length).to.eql(1);
      expect(gasCompAccountedOpRequest.gasPrice).to.eql(1n);
      expect(gasCompAccountedOpRequest.gasAsset).to.eql(shitcoin);

      const gasAccountedJoinSplitRequest =
        gasCompAccountedOpRequest.joinSplitRequests[0];
      expect(gasAccountedJoinSplitRequest.asset).to.eql(shitcoin);

      const expectedGasEstimate = gasCompensationForParams({
        executionGasLimit: 1_000_000n,
        numJoinSplits: 1,
        numUniqueAssets: 1,
      });
      expect(
        gasAccountedJoinSplitRequest.unwrapValue >=
          100_000n + expectedGasEstimate * 1n
      ).to.be.true;
    });

    it("2 notes not in gas asset, does not cover ∃ 1 other note > remainder + extra JS cost", async () => {
      const [nocturneDB, merkleProver, signer, handlerContract] = await setup(
        [500_000n, 500_000n, 3_000_000n],
        [shitcoin, shitcoin, stablescam]
      );
      const deps = {
        db: nocturneDB,
        handlerContract,
        merkle: merkleProver,
        viewer: signer,
        gasAssets: testGasAssets(stablescam),
        tokenConverter: new MockEthToTokenConverter(),
      };

      const builder = newOpRequestBuilder(provider, 1n, DUMMY_CONFIG);
      const opRequest = await builder
        .__action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
        .__unwrap(shitcoin, 1_000_000n)
        .__refund({ asset: shitcoin, minRefundValue: 1n })
        .gas({
          executionGasLimit: 500_000n, // WTF
          gasPrice: 1n,
        })
        .deadline(1n)
        .build();

      const gasCompAccountedOpRequest = await handleGasForOperationRequest(
        deps,
        opRequest.request,
        gasMultiplier
      );

      const expectedJoinSplitRequestUnwrap: JoinSplitRequest = {
        asset: shitcoin,
        unwrapValue: 1_000_000n, // just the 1M requested in unwrap
      };

      expect(gasCompAccountedOpRequest.gasPrice).to.eql(1n);
      expect(gasCompAccountedOpRequest.gasAsset).to.eql(stablescam);

      expect(gasCompAccountedOpRequest.joinSplitRequests.length).to.eql(2);
      expect(gasCompAccountedOpRequest.joinSplitRequests[0]).to.eql(
        expectedJoinSplitRequestUnwrap
      );

      // expect total value in JSRs for gas to be at least gas comp
      const expectedGasEstimate = gasCompensationForParams({
        executionGasLimit: 500_000n,
        numJoinSplits: 2,
        numUniqueAssets: 2,
      });

      expect(
        gasCompAccountedOpRequest.joinSplitRequests[1].unwrapValue >=
          expectedGasEstimate * 1n
      ).to.be.true;
    });

    it("1 note in gas asset, does not cover, ∃ 3 other notes > remainder + extra JS cost in different gas asset", async () => {
      // have several stablescam notes that can pay for gas, but need several to cover it when accounting for
      // additional JSs
      const [nocturneDB, merkleProver, signer, handlerContract] = await setup(
        [500_000n, 7_000_000n, 7_000_000n, 7_000_000n],
        [shitcoin, stablescam, stablescam, stablescam]
      );
      const deps = {
        handlerContract,
        merkle: merkleProver,
        viewer: signer,
        gasAssets: testGasAssets(shitcoin, stablescam),
        tokenConverter: new MockEthToTokenConverter(),
        db: nocturneDB,
      };

      const builder = newOpRequestBuilder(provider, 1n, DUMMY_CONFIG);
      const opRequest = await builder
        .__action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
        .__unwrap(shitcoin, 200_000n)
        .__refund({ asset: shitcoin, minRefundValue: 1n })
        .gas({
          executionGasLimit: 200_000n,
          gasPrice: 10n,
        })
        .deadline(1n)
        .build();

      const gasCompAccountedOperationRequest =
        await handleGasForOperationRequest(
          deps,
          opRequest.request,
          gasMultiplier
        );

      const gasUnwrap = gasCompAccountedOperationRequest.joinSplitRequests
        .filter((req) => req.asset.assetAddr === stablescam.assetAddr)
        .reduce((acc, req) => acc + req.unwrapValue, 0n);
      const expectedGasEstimate = gasCompensationForParams({
        executionGasLimit: 200_000n,
        numJoinSplits: 3,
        numUniqueAssets: 2,
      });
      expect(gasUnwrap >= expectedGasEstimate * 10n).to.be.true;
    });

    it("1 JS req in gas asset, does not cover, ∃ 1 other note > gas limit in different asset", async () => {
      const [nocturneDB, merkleProver, signer, handlerContract] = await setup(
        [500_000n, 500_000n, 500_000n, 4_000_000n],
        [shitcoin, shitcoin, shitcoin, stablescam]
      );
      const deps = {
        handlerContract,
        merkle: merkleProver,
        viewer: signer,
        gasAssets: testGasAssets(shitcoin, stablescam),
        tokenConverter: new MockEthToTokenConverter(),
        db: nocturneDB,
      };

      const builder = newOpRequestBuilder(provider, 1n, DUMMY_CONFIG);
      const opRequest = await builder
        .__action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
        .__unwrap(shitcoin, 100_000n)
        .__refund({ asset: shitcoin, minRefundValue: 1n })
        .gas({
          // Exceeds shitcoin balance, forces us to use stablescam
          executionGasLimit: 1_500_000n,
          gasPrice: 1n,
        })
        .deadline(1n)
        .build();

      const gasCompAccountedOperationRequest =
        await handleGasForOperationRequest(
          deps,
          opRequest.request,
          gasMultiplier
        );

      expect(gasCompAccountedOperationRequest.gasPrice).to.eql(1n);
      expect(
        gasCompAccountedOperationRequest.joinSplitRequests.length
      ).to.equal(2);
      expect(gasCompAccountedOperationRequest.gasAsset).to.eql(stablescam);

      const joinSplitRequestForOp =
        gasCompAccountedOperationRequest.joinSplitRequests[0];
      expect(joinSplitRequestForOp.asset).to.eql(shitcoin);
      expect(joinSplitRequestForOp.unwrapValue).to.eql(100_000n);

      const joinSplitRequestForGas =
        gasCompAccountedOperationRequest.joinSplitRequests[1];
      expect(joinSplitRequestForGas.asset).to.eql(stablescam);

      const expectedGasEstimate = gasCompensationForParams({
        executionGasLimit: 1_500_000n,
        numJoinSplits: 2,
        numUniqueAssets: 2,
      });
      // exact amount depends
      expect(joinSplitRequestForGas.unwrapValue >= expectedGasEstimate * 1n).to
        .be.true;
    });

    it("1 JS req, covers gas cost", async () => {
      const [nocturneDB, merkleProver, signer, handlerContract] = await setup(
        [100_000_000n],
        [shitcoin]
      );
      const deps = {
        db: nocturneDB,
        handlerContract,
        merkle: merkleProver,
        viewer: signer,
        gasAssets: testGasAssets(shitcoin),
        tokenConverter: new MockEthToTokenConverter(),
      };

      const builder = newOpRequestBuilder(provider, 1n, DUMMY_CONFIG);

      // Need 1M tokens to unwrap + op gas estimate with 1 joinsplit (860k * 10)
      // 860k * 10 = 8.6M needed for gas but can all be handled by the big 100M note
      const opRequest = await builder
        .__action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
        .__unwrap(shitcoin, 1_000_000n)
        .gas({
          executionGasLimit: 1n,
          gasPrice: 10n,
        })
        .deadline(1n)
        .build();

      const gasCompAccountedOpRequest = await handleGasForOperationRequest(
        deps,
        opRequest.request,
        gasMultiplier
      );

      expect(gasCompAccountedOpRequest.gasPrice).to.eql(10n);
      expect(gasCompAccountedOpRequest.gasAsset).to.eql(shitcoin);

      const expectedGasEstimate = gasCompensationForParams({
        executionGasLimit: 1n,
        numJoinSplits: 1,
        numUniqueAssets: 1,
      });

      expect(
        gasCompAccountedOpRequest.joinSplitRequests[0].unwrapValue >=
          1_000_000n + expectedGasEstimate * 10n
      ).to.be.true;
    });
  });

  describe("throws NotEnoughGasError with...", () => {
    it("1 note in gas asset, does not cover", async () => {
      const [nocturneDB, merkleProver, signer, handlerContract] = await setup(
        [500_000n],
        [shitcoin]
      );
      const deps = {
        db: nocturneDB,
        handlerContract,
        merkle: merkleProver,
        viewer: signer,
        gasAssets: testGasAssets(shitcoin),
        tokenConverter: new MockEthToTokenConverter(),
      };

      const builder = newOpRequestBuilder(provider, 1n, DUMMY_CONFIG);
      const opRequest = await builder
        .__action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
        .__unwrap(shitcoin, 100_000n)
        .gas({
          executionGasLimit: 100_000n,
          gasPrice: 1n,
        })
        .deadline(1n)
        .build();

      await expect(
        handleGasForOperationRequest(deps, opRequest.request, gasMultiplier)
      ).to.be.rejectedWith("Not enough gas");
    });

    it("3 notes in different gas assets, all don't cover", async () => {
      const [nocturneDB, merkleProver, signer, handlerContract] = await setup(
        [500_000n, 500_000n, 500_000n],
        [shitcoin, stablescam, ponzi]
      );
      const deps = {
        db: nocturneDB,
        handlerContract,
        merkle: merkleProver,
        viewer: signer,
        gasAssets: testGasAssets(shitcoin, stablescam, ponzi),
        tokenConverter: new MockEthToTokenConverter(),
      };

      const builder = newOpRequestBuilder(provider, 1n, DUMMY_CONFIG);
      const opRequest = await builder
        .__action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
        .gas({
          executionGasLimit: 150_000n,
          gasPrice: 1n,
        })
        .deadline(1n)
        .build();

      await expect(
        handleGasForOperationRequest(deps, opRequest.request, gasMultiplier)
      ).to.be.rejectedWith("Not enough gas");
    });

    it("1 non-gas asset in req, 1 gas asset, doesn't cover", async () => {
      const [nocturneDB, merkleProver, signer, handlerContract] = await setup(
        [500_000n, 500_000n],
        [shitcoin, stablescam]
      );

      const deps = {
        db: nocturneDB,
        handlerContract,
        merkle: merkleProver,
        viewer: signer,
        gasAssets: testGasAssets(stablescam),
        tokenConverter: new MockEthToTokenConverter(),
      };

      const builder = newOpRequestBuilder(provider, 1n, DUMMY_CONFIG);
      const opRequest = await builder
        .__action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
        // 1M shitcoin, 1M stablescam, 1M stablescam
        .__unwrap(shitcoin, 500_000n)
        .gas({
          executionGasLimit: 200_000n,
          gasPrice: 1n,
        })
        .deadline(1n)
        .build();

      await expect(
        handleGasForOperationRequest(deps, opRequest.request, gasMultiplier)
      ).to.be.rejectedWith("Not enough gas");
    });

    it("3 notes in different gas assets, one in request, others not, all don't cover", async () => {
      const [nocturneDB, merkleProver, signer, handlerContract] = await setup(
        [500_000n, 500_000n, 500_000n],
        [shitcoin, stablescam, ponzi]
      );

      const deps = {
        db: nocturneDB,
        handlerContract,
        merkle: merkleProver,
        viewer: signer,
        gasAssets: testGasAssets(stablescam, ponzi),
        tokenConverter: new MockEthToTokenConverter(),
      };

      const builder = newOpRequestBuilder(provider, 1n, DUMMY_CONFIG);
      const opRequest = await builder
        .__action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
        // 1M shitcoin, 1M stablescam, 1M stablescam
        .__unwrap(shitcoin, 100_000n)
        .gas({
          executionGasLimit: 200_000n,
          gasPrice: 1n,
        })
        .deadline(1n)
        .build();

      await expect(
        handleGasForOperationRequest(deps, opRequest.request, gasMultiplier)
      ).to.be.rejectedWith("Not enough gas");
    });

    it("1 note in gas asset, note value covers op on its own, gas on its own, but not both", async () => {
      const [nocturneDB, merkleProver, signer, handlerContract] = await setup(
        [800_000n],
        [shitcoin]
      );

      const deps = {
        db: nocturneDB,
        handlerContract,
        merkle: merkleProver,
        viewer: signer,
        gasAssets: testGasAssets(shitcoin),
        tokenConverter: new MockEthToTokenConverter(),
      };

      const builder = newOpRequestBuilder(provider, 1n, DUMMY_CONFIG);
      const opRequest = await builder
        .__action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
        .__unwrap(shitcoin, 600_000n)
        .gas({
          executionGasLimit: 100_000n,
          gasPrice: 1n,
        })
        .deadline(1n)
        .build();

      await expect(
        handleGasForOperationRequest(deps, opRequest.request, gasMultiplier)
      ).to.be.rejectedWith("Not enough gas");
    });

    it("5 notes in gas asset, not enough to cover costs for additional JSs", async () => {
      // 500K < per-joinsplit cost assuming no batch (660)
      const [nocturneDB, merkleProver, signer, handlerContract] = await setup(
        [500_000n, 250_000n, 250_000n, 250_000n, 250_000n],
        [shitcoin, shitcoin, shitcoin, shitcoin, shitcoin]
      );

      const deps = {
        db: nocturneDB,
        handlerContract,
        merkle: merkleProver,
        viewer: signer,
        gasAssets: testGasAssets(shitcoin, stablescam, ponzi),
        tokenConverter: new MockEthToTokenConverter(),
      };

      const builder = newOpRequestBuilder(provider, 1n, DUMMY_CONFIG);
      const opRequest = await builder
        .__action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
        .gas({
          executionGasLimit: 200_000n,
          gasPrice: 1n,
        })
        .deadline(1n)
        .build();

      await expect(
        handleGasForOperationRequest(deps, opRequest.request, gasMultiplier)
      ).to.be.rejectedWith("Not enough gas");
    });
  });
});
