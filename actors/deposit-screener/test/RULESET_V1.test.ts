import { expect } from "chai";
import fs from "fs";
import path from "path";
import { RULESET_V1 } from "../src/screening/checks/v1/RULESET_V1";
import {
  APPROVE_ADDRESSES,
  AddressDataSnapshot,
  // APPROVE_ADDRESSES,
  BULK_TEST_CASES,
  REJECT_ADDRESSES,
  formDepositInfo,
  getLatestSnapshotFolder,
  toMistrackResponse,
  toTrmResponse,
  // REJECT_ADDRESSES,
} from "./utils";
import findWorkspaceRoot from "find-yarn-workspace-root";
import { isRejection, RuleSet } from "../src/screening/checks/RuleSet";
import RedisMemoryServer from "redis-memory-server";
import IORedis from "ioredis";
import {
  formatRequestData,
  // ApiCallNames,
  API_CALL_MAP,
  TrmData,
  MisttrackData,
} from "../src/screening/checks/apiCalls";
import {
  formatCachedFetchCacheKey,
  serializeResponse,
} from "@nocturne-xyz/offchain-utils";
import * as JSON from "bigint-json-serialization";

async function populateRedisCache(redis: IORedis): Promise<void> {
  // Pull snapshot data from the latest snapshot folder
  const maybeFolderPath = await getLatestSnapshotFolder("./snapshots");
  const filePath = path.join(
    `${findWorkspaceRoot()!}/actors/deposit-screener/test`,
    maybeFolderPath ?? "",
    "snapshot.json"
  );

  let snapshotData: AddressDataSnapshot = {};
  if (fs.existsSync(filePath)) {
    const rawData = fs.readFileSync(filePath, "utf-8");
    snapshotData = JSON.parse(rawData);
  } else {
    throw new Error("No snapshot files found");
  }

  // Populate Redis cache with snapshot data
  type ApiCallNamesList = Array<keyof typeof API_CALL_MAP>;
  const apiCallNames: ApiCallNamesList = Object.keys(
    API_CALL_MAP
  ) as ApiCallNamesList;

  console.log(snapshotData);
  console.log("Num snapshot keys:", Object.keys(snapshotData).length);
  console.log("Num snapshot entries:", Object.entries(snapshotData).length);

  for (const [address, snapshotForAddress] of Object.entries(snapshotData)) {
    const depositRequest = formDepositInfo(address);
    for (const apiCallName of apiCallNames) {
      const apiCallReturnData = snapshotForAddress[apiCallName];
      if (!apiCallReturnData || apiCallName == "IDENTITY") {
        console.log(
          `No snapshot data found for address=${address} and apiCallName=${apiCallName}`
        );
        continue;
      }

      let response: Response;
      if (apiCallName == "TRM_SCREENING_ADDRESSES") {
        response = toTrmResponse(apiCallReturnData as TrmData);
        console.log("TRM RESPONSE:", response);
        console.log("TRM RESPONSE STRINGIFIED:", JSON.stringify(response));
      } else if (apiCallName == "MISTTRACK_ADDRESS_LABELS") {
        response = toMistrackResponse(apiCallReturnData as MisttrackData);
      } else if (apiCallName == "MISTTRACK_ADDRESS_OVERVIEW") {
        response = toMistrackResponse(apiCallReturnData as MisttrackData);
      } else if (apiCallName == "MISTTRACK_ADDRESS_RISK_SCORE") {
        response = toMistrackResponse(apiCallReturnData as MisttrackData);
      } else {
        throw new Error(`unknown apiCallName: ${apiCallName}`);
      }

      const { requestInfo, requestInit } = formatRequestData(
        apiCallName,
        depositRequest
      );
      const cacheKey = formatCachedFetchCacheKey(requestInfo, requestInit);

      const serializedResponse = await serializeResponse(response);

      console.log(`Setting cache entry for address ${address}`);
      console.log(`cacheKey=${cacheKey}`);
      console.log(`apiCallReturnData=${serializedResponse}`);
      await redis.set(cacheKey, serializedResponse);
    }
  }
}

describe("RULESET_V1", () => {
  let server: RedisMemoryServer;
  let redis: IORedis;
  let ruleset: RuleSet;

  before(async () => {
    server = await RedisMemoryServer.create();

    const host = await server.getHost();
    const port = await server.getPort();
    redis = new IORedis(port, host);

    await populateRedisCache(redis);

    ruleset = RULESET_V1(redis);
  });

  describe("Bulk Tests", async () => {
    for (const testCase of BULK_TEST_CASES) {
      for (const address of testCase.addresses) {
        it(`bulk test: isRejected=${testCase.isRejected}, type=${testCase.type}, address=${address}`, async () => {
          const result = await ruleset.check(formDepositInfo(address));
          expect(result.type).to.equal(
            testCase.isRejected ? "Rejection" : "Delay"
          );
          if (isRejection(result)) {
            expect(result.reason).to.equal(testCase.reason);
          }
        });
      }
    }

    describe("Rejections", async () => {
      it("should reject RocketSwap exploiter", async () => {
        const result = await ruleset.check(
          formDepositInfo(REJECT_ADDRESSES.ROCKETSWAP)
        );
        expect(result.type).to.equal("Rejection");
      });

      it("should reject Zunami exploiter", async () => {
        const result = await ruleset.check(
          formDepositInfo(REJECT_ADDRESSES.ZUNAMI)
        );
        expect(result.type).to.equal("Rejection");
      });

      it("should reject Zunami 2nd Degree exploiter", async () => {
        const result = await ruleset.check(
          formDepositInfo(REJECT_ADDRESSES.ZUNAMI_2ND_DEGREE)
        );
        expect(result.type).to.equal("Rejection");
      });

      it("should reject Steadefi exploiter", async () => {
        const result = await ruleset.check(
          formDepositInfo(REJECT_ADDRESSES.STEADEFI)
        );
        expect(result.type).to.equal("Rejection");
      });

      it("should reject Earning.Farm exploiter", async () => {
        const result = await ruleset.check(
          formDepositInfo(REJECT_ADDRESSES.EARNING_FARM)
        );
        expect(result.type).to.equal("Rejection");
      });

      it("should reject suspicious TC user", async () => {
        const result = await ruleset.check(
          formDepositInfo(REJECT_ADDRESSES.SUS_TC_USER)
        );
        expect(result.type).to.equal("Rejection");
      });

      it("should reject Swirlend exploiter", async () => {
        const result = await ruleset.check(
          formDepositInfo(REJECT_ADDRESSES.SWIRLEND)
        );
        expect(result.type).to.equal("Rejection");
      });

      it("should reject Aztec user 4 due to TRM_HIGH_INDIRECT_REJECT", async () => {
        const result = await ruleset.check(
          formDepositInfo(REJECT_ADDRESSES.AZTEC_4)
        );
        expect(result).to.deep.equal({
          type: "Rejection",
          reason: "Indirect exposure to high risk categories > $20k",
        });
      });

      it("should reject TC user 1 due to MISTTRACK_RISK_REJECT", async () => {
        const result = await ruleset.check(
          formDepositInfo(REJECT_ADDRESSES.TC_1)
        );
        expect(result).to.deep.equal({
          type: "Rejection",
          reason: "Score > 80 AND phishing/theft has > 0 attributions",
        });
      });

      it("should reject TC user 4 due to MISTTRACK_RISK_REJECT", async () => {
        const result = await ruleset.check(
          formDepositInfo(REJECT_ADDRESSES.TC_4)
        );
        expect(result).to.deep.equal({
          type: "Rejection",
          reason: "Score > 80 AND phishing/theft has > 0 attributions",
        });
      });

      it("should reject TC user 6 due to MISTTRACK_RISK_REJECT", async () => {
        const result = await ruleset.check(
          formDepositInfo(REJECT_ADDRESSES.TC_6)
        );
        expect(result).to.deep.equal({
          type: "Rejection",
          reason: "Score > 80 AND phishing/theft has > 0 attributions",
        });
      });

      it("should reject TC user 7 due to MISTTRACK_RISK_REJECT", async () => {
        const result = await ruleset.check(
          formDepositInfo(REJECT_ADDRESSES.TC_7)
        );
        expect(result).to.deep.equal({
          type: "Rejection",
          reason: "Score > 80 AND phishing/theft has > 0 attributions",
        });
      });
    });

    describe("Approvals", () => {
      it("should approve Vitalik", async () => {
        const result = await ruleset.check(
          formDepositInfo(APPROVE_ADDRESSES.VITALIK)
        );
        expect(result.type).to.equal("Delay");
      });

      it("should approve Beiko", async () => {
        const result = await ruleset.check(
          formDepositInfo(APPROVE_ADDRESSES.BEIKO)
        );
        expect(result.type).to.equal("Delay");
      });
      it("should approve TC user 2", async () => {
        const result = await ruleset.check(
          formDepositInfo(APPROVE_ADDRESSES.TC_2)
        );
        expect(result).to.deep.equal({
          type: "Delay",
          timeSeconds: 21600,
        });
      });
      it("should approve TC user 3", async () => {
        const result = await ruleset.check(
          formDepositInfo(APPROVE_ADDRESSES.TC_3)
        );
        expect(result).to.deep.equal({
          type: "Delay",
          timeSeconds: 21600,
        });
      });

      it("should approve TC user 5", async () => {
        const result = await ruleset.check(
          formDepositInfo(APPROVE_ADDRESSES.TC_5)
        );
        expect(result).to.deep.equal({
          type: "Delay",
          timeSeconds: 21600,
        });
      });

      it("should approve Aztec user 1", async () => {
        const result = await ruleset.check(
          formDepositInfo(APPROVE_ADDRESSES.AZTEC_1)
        );
        expect(result).to.deep.equal({
          timeSeconds: 21600,
          type: "Delay",
        });
      });

      it("should approve Aztec user 2", async () => {
        const result = await ruleset.check(
          formDepositInfo(APPROVE_ADDRESSES.AZTEC_2)
        );
        expect(result).to.deep.equal({
          type: "Delay",
          timeSeconds: 7200,
        });
      });

      it("should approve Aztec user 3", async () => {
        const result = await ruleset.check(
          formDepositInfo(APPROVE_ADDRESSES.AZTEC_3)
        );
        expect(result).to.deep.equal({
          timeSeconds: 7200,
          type: "Delay",
        });
      });
    });
  });
});
