import { expect } from "chai";
import fs from "fs";
import path from "path";
import { RULESET_V1 } from "../src/screening/checks/v1/RULESET_V1";
import {
  AddressDataSnapshot,
  APPROVE_ADDRESSES,
  BULK_TEST_CASES,
  formDepositInfo,
  getLatestSnapshotFolder,
  REJECT_ADDRESSES,
} from "./utils";
import findWorkspaceRoot from "find-yarn-workspace-root";

describe("RULESET_V1", () => {
  let snapshotData: AddressDataSnapshot = {};
  before(async () => {
    const maybeFolderPath = await getLatestSnapshotFolder("./snapshots");
    const filePath = path.join(
      `${findWorkspaceRoot()!}/actors/deposit-screener/test`,
      maybeFolderPath ?? "",
      "snapshot.json"
    );
    if (fs.existsSync(filePath)) {
      const rawData = fs.readFileSync(filePath, "utf-8");
      snapshotData = JSON.parse(rawData);
    } else {
      throw new Error("No snapshot files found");
    }
  });

  describe("Bulk Tests", () => {
    for (const testCase of BULK_TEST_CASES) {
      for (const address of testCase.addresses) {
        it(`bulk test: isRejected=${testCase.isRejected}, type=${testCase.type}, address=${address}`, async () => {
          const mockedResponse = snapshotData[address];
          expect(
            mockedResponse,
            `mockedResponse is not found for address=${address}`
          ).to.be.ok;

          const result = await RULESET_V1.check(
            formDepositInfo(address),
            snapshotData[address]
          );
          expect(result.type).to.equal(
            testCase.isRejected ? "Rejection" : "Delay"
          );
        });
      }
    }
  });

  describe("Rejections", () => {
    it("should reject RocketSwap exploiter", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(REJECT_ADDRESSES.ROCKETSWAP),
        snapshotData[REJECT_ADDRESSES.ROCKETSWAP]
      );
      expect(result.type).to.equal("Rejection");
    });

    it("should reject Zunami exploiter", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(REJECT_ADDRESSES.ZUNAMI),
        snapshotData[REJECT_ADDRESSES.ZUNAMI]
      );
      expect(result.type).to.equal("Rejection");
    });

    it("should reject Zunami 2nd Degree exploiter", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(REJECT_ADDRESSES.ZUNAMI_2ND_DEGREE),
        snapshotData[REJECT_ADDRESSES.ZUNAMI_2ND_DEGREE]
      );
      expect(result.type).to.equal("Rejection");
    });

    it("should reject Steadefi exploiter", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(REJECT_ADDRESSES.STEADEFI),
        snapshotData[REJECT_ADDRESSES.STEADEFI]
      );
      expect(result.type).to.equal("Rejection");
    });

    it("should reject Earning.Farm exploiter", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(REJECT_ADDRESSES.EARNING_FARM),
        snapshotData[REJECT_ADDRESSES.EARNING_FARM]
      );
      expect(result.type).to.equal("Rejection");
    });

    it("should reject suspicious TC user", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(REJECT_ADDRESSES.SUS_TC_USER),
        snapshotData[REJECT_ADDRESSES.SUS_TC_USER]
      );
      expect(result.type).to.equal("Rejection");
    });

    it("should reject Swirlend exploiter", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(REJECT_ADDRESSES.SWIRLEND),
        snapshotData[REJECT_ADDRESSES.SWIRLEND]
      );
      expect(result.type).to.equal("Rejection");
    });

    it("should reject Aztec user 4 due to TRM_HIGH_INDIRECT_REJECT", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(REJECT_ADDRESSES.AZTEC_4),
        snapshotData[REJECT_ADDRESSES.AZTEC_4]
      );
      expect(result).to.deep.equal({
        type: "Rejection",
        reason: "Indirect exposure to high risk categories > $20k",
      });
    });

    it("should reject TC user 1 due to MISTTRACK_RISK_REJECT", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(REJECT_ADDRESSES.TC_1),
        snapshotData[REJECT_ADDRESSES.TC_1]
      );
      expect(result).to.deep.equal({
        type: "Rejection",
        reason: "Score > 80 AND phishing/theft has > 0 attributions",
      });
    });

    it("should reject TC user 4 due to MISTTRACK_RISK_REJECT", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(REJECT_ADDRESSES.TC_4),
        snapshotData[REJECT_ADDRESSES.TC_4]
      );
      expect(result).to.deep.equal({
        type: "Rejection",
        reason: "Score > 80 AND phishing/theft has > 0 attributions",
      });
    });

    it("should reject TC user 6 due to MISTTRACK_RISK_REJECT", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(REJECT_ADDRESSES.TC_6),
        snapshotData[REJECT_ADDRESSES.TC_6]
      );
      expect(result).to.deep.equal({
        type: "Rejection",
        reason: "Score > 80 AND phishing/theft has > 0 attributions",
      });
    });
    it("should reject TC user 7 due to MISTTRACK_RISK_REJECT", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(REJECT_ADDRESSES.TC_7),
        snapshotData[REJECT_ADDRESSES.TC_7]
      );
      expect(result).to.deep.equal({
        type: "Rejection",
        reason: "Score > 80 AND phishing/theft has > 0 attributions",
      });
    });
  });

  describe("Approvals", () => {
    it("should approve Vitalik", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(APPROVE_ADDRESSES.VITALIK),
        snapshotData[APPROVE_ADDRESSES.VITALIK]
      );
      expect(result.type).to.equal("Delay");
    });

    it("should approve Beiko", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(APPROVE_ADDRESSES.BEIKO),
        snapshotData[APPROVE_ADDRESSES.BEIKO]
      );
      expect(result.type).to.equal("Delay");
    });
    it("should approve TC user 2", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(APPROVE_ADDRESSES.TC_2),
        snapshotData[APPROVE_ADDRESSES.TC_2]
      );
      expect(result).to.deep.equal({
        type: "Delay",
        timeSeconds: 21600,
      });
    });
    it("should approve TC user 3", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(APPROVE_ADDRESSES.TC_3),
        snapshotData[APPROVE_ADDRESSES.TC_3]
      );
      expect(result).to.deep.equal({
        type: "Delay",
        timeSeconds: 21600,
      });
    });

    it("should approve TC user 5", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(APPROVE_ADDRESSES.TC_5),
        snapshotData[APPROVE_ADDRESSES.TC_5]
      );
      expect(result).to.deep.equal({
        type: "Delay",
        timeSeconds: 21600,
      });
    });
    it("should approve Aztec user 1", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(APPROVE_ADDRESSES.AZTEC_1),
        snapshotData[APPROVE_ADDRESSES.AZTEC_1]
      );
      expect(result).to.deep.equal({
        timeSeconds: 21600,
        type: "Delay",
      });
    });

    it("should approve Aztec user 2", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(APPROVE_ADDRESSES.AZTEC_2),
        snapshotData[APPROVE_ADDRESSES.AZTEC_2]
      );
      expect(result).to.deep.equal({
        type: "Delay",
        timeSeconds: 7200,
      });
    });

    it("should approve Aztec user 3", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(APPROVE_ADDRESSES.AZTEC_3),
        snapshotData[APPROVE_ADDRESSES.AZTEC_3]
      );
      expect(result).to.deep.equal({
        timeSeconds: 7200,
        type: "Delay",
      });
    });
  });
});
