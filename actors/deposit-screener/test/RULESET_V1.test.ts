import { expect } from "chai";
import fs from "fs";
import path from "path";
import { RULESET_V1 } from "../src/screening/checks/v1/RULESET_V1";
import {
  APPROVE_ADDRESSES,
  BULK_TEST_CASES,
  REJECT_ADDRESSES,
} from "./snapshotTestCases";
import findWorkspaceRoot from "find-yarn-workspace-root";
import { isRejection, RuleSet } from "../src/screening/checks/RuleSet";
import RedisMemoryServer from "redis-memory-server";
import IORedis from "ioredis";
import {
  AddressDataSnapshot,
  formDepositInfo,
  populateRedisCache,
} from "../src/cli/commands/inspect/helpers";
import { getLatestSnapshotFolder } from "./utils";
import { makeLogger } from "@nocturne-xyz/offchain-utils";
import moment from "moment-timezone";
import * as sinon from "sinon";
import { FIVE_ETHER } from "../src/screening/checks/v1/utils";

const WHITELISTED_ADDRESSES_1 = "0x47794AB20f45Bdc18ef6EcBcB19E1FdF82C6E8Db";
const WHITELISTED_ADDRESSES_2 = "0x52eb4040819bd0f49cb6ea01e5d33d328a25cc3f";

describe("RULESET_V1", () => {
  let server: RedisMemoryServer;
  let redis: IORedis;
  let ruleset: RuleSet;

  beforeEach(() => {
    const mockDate = moment
      .tz("2023-11-20 10:00:00", "America/New_York")
      .toDate();
    sinon.useFakeTimers(mockDate.getTime());
  });

  before(async () => {
    process.env.DEFAULT_ALLOWLIST = `${WHITELISTED_ADDRESSES_1},${WHITELISTED_ADDRESSES_2}`;

    server = await RedisMemoryServer.create();

    const host = await server.getHost();
    const port = await server.getPort();
    redis = new IORedis(port, host);

    const maybeFolderPath = await getLatestSnapshotFolder("./snapshots");
    const filePath = path.join(
      `${findWorkspaceRoot()!}/actors/deposit-screener/test`,
      maybeFolderPath ?? "",
      "snapshot.json"
    );

    const snapshotData = JSON.parse(
      fs.readFileSync(filePath, "utf-8")
    ) as AddressDataSnapshot;
    await populateRedisCache(snapshotData, redis);

    const logger = makeLogger(
      "snapshot",
      "deposit-screener",
      "server",
      "debug",
      "./logs"
    );

    ruleset = RULESET_V1(redis, logger);
  });

  afterEach(() => {
    sinon.restore();
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

      // TODO: This TC user should be rejected but is not according to our current rules.

      // it("should reject suspicious TC user", async () => {
      //   const result = await ruleset.check(
      //     formDepositInfo(REJECT_ADDRESSES.SUS_TC_USER)
      //   );
      //   expect(result.type).to.equal("Rejection");
      // });

      it("should reject Swirlend exploiter", async () => {
        const result = await ruleset.check(
          formDepositInfo(REJECT_ADDRESSES.SWIRLEND)
        );
        expect(result.type).to.equal("Rejection");
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
      it("should approve Aztec user 4", async () => {
        const result = await ruleset.check(
          formDepositInfo(APPROVE_ADDRESSES.AZTEC_4)
        );
        expect(result.type).to.equal("Delay");
      });

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

  it("adds delay if sleeping US timezone evening", async () => {
    const largeDeposit = formDepositInfo(APPROVE_ADDRESSES.AZTEC_3);
    largeDeposit.value = FIVE_ETHER;

    // We need separately init'ed sinon for this special case
    sinon.restore();

    // Set the new time and capture a brand new clock instance
    const newTime = moment
      .tz("2023-11-20 22:00:00", "America/New_York")
      .valueOf();
    const clock = sinon.useFakeTimers(newTime);
    clock.setSystemTime(newTime);

    const result = await ruleset.check(largeDeposit);

    expect(result).to.deep.equal({
      timeSeconds: 7200 + 3600 * 9,
      type: "Delay",
    });
  });

  it("adds delay if sleeping US timezone next morning", async () => {
    const largeDeposit = formDepositInfo(APPROVE_ADDRESSES.AZTEC_3);
    largeDeposit.value = FIVE_ETHER;

    // We need separately init'ed sinon for this special case
    sinon.restore();

    // Set the new time and capture a brand new clock instance
    const newTime = moment
      .tz("2023-11-21 01:00:00", "America/New_York")
      .valueOf();
    const clock = sinon.useFakeTimers(newTime);
    clock.setSystemTime(newTime);

    const result = await ruleset.check(largeDeposit);

    expect(result).to.deep.equal({
      timeSeconds: 7200 + 3600 * 6,
      type: "Delay",
    });
  });

  it("should give 0 delay to whitelisted users", async () => {
    process.env.DEFAULT_ALLOWLIST = `${WHITELISTED_ADDRESSES_1},${WHITELISTED_ADDRESSES_2}`;

    const result1 = await ruleset.check(
      formDepositInfo(WHITELISTED_ADDRESSES_1)
    );
    const result2 = await ruleset.check(
      formDepositInfo(WHITELISTED_ADDRESSES_2)
    );
    expect(result1).to.deep.equal({ type: "Accept" });
    expect(result2).to.deep.equal({ type: "Accept" });
  });
});
