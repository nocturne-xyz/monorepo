import { expect } from "chai";
import fs from "fs";
import path from "path";
import { CachedApiCallData } from "../src/screening/checks/RuleSet";
import { RULESET_V1 } from "../src/screening/checks/v1/RULESET_V1";
import apiCallsSnapshot from "./snapshots/apiCallsSnapshot09-13-2023.json";
import {
  APPROVE_ADDRESSES,
  AddressDataSnapshot,
  REJECT_ADDRESSES,
  ScreeningTestCaseAddresses,
  formDepositInfo,
  getLatestSnapshotFolder,
} from "./utils";

const MOCK_API_CALLS = apiCallsSnapshot as Record<
  ScreeningTestCaseAddresses,
  CachedApiCallData
>;

describe("RULESET_V1", () => {
  let snapshotData: AddressDataSnapshot = {};
  before(async () => {
    const folderPath = (await getLatestSnapshotFolder("./snapshots")) ?? "";
    const filePath = path.join(folderPath, "snapshot.json");
    if (fs.existsSync(filePath)) {
      const rawData = fs.readFileSync(filePath, "utf-8");
      snapshotData = JSON.parse(rawData);
    } else {
      throw new Error("No snapshot files found");
    }
  });

  describe("Rejections", () => {
    it("should reject RocketSwap exploiter", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(REJECT_ADDRESSES.ROCKETSWAP),
        MOCK_API_CALLS[REJECT_ADDRESSES.ROCKETSWAP]
      );
      expect(result.type).to.equal("Rejection");
    });

    it("should reject Zunami exploiter", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(REJECT_ADDRESSES.ZUNAMI),
        MOCK_API_CALLS[REJECT_ADDRESSES.ZUNAMI]
      );
      expect(result.type).to.equal("Rejection");
    });

    it("should reject Zunami 2nd Degree exploiter", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(REJECT_ADDRESSES.ZUNAMI_2ND_DEGREE),
        MOCK_API_CALLS[REJECT_ADDRESSES.ZUNAMI_2ND_DEGREE]
      );
      expect(result.type).to.equal("Rejection");
    });

    it("should reject Steadefi exploiter", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(REJECT_ADDRESSES.STEADEFI),
        MOCK_API_CALLS[REJECT_ADDRESSES.STEADEFI]
      );
      expect(result.type).to.equal("Rejection");
    });

    it("should reject Earning.Farm exploiter", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(REJECT_ADDRESSES.EARNING_FARM),
        MOCK_API_CALLS[REJECT_ADDRESSES.EARNING_FARM]
      );
      expect(result.type).to.equal("Rejection");
    });

    it("should reject suspicious TC user", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(REJECT_ADDRESSES.SUS_TC_USER),
        MOCK_API_CALLS[REJECT_ADDRESSES.SUS_TC_USER]
      );
      expect(result.type).to.equal("Rejection");
    });

    it("should reject Swirlend exploiter", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(REJECT_ADDRESSES.SWIRLEND),
        MOCK_API_CALLS[REJECT_ADDRESSES.SWIRLEND]
      );
      expect(result.type).to.equal("Rejection");
    });

    it("should reject Aztec user 4 due to TRM_HIGH_INDIRECT_REJECT", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(REJECT_ADDRESSES.AZTEC_4),
        MOCK_API_CALLS[REJECT_ADDRESSES.AZTEC_4]
      );
      expect(result).to.deep.equal({
        type: "Rejection",
        reason: "Indirect exposure to high risk categories > $20k",
      });
    });

    it("should reject TC user 1 due to MISTTRACK_RISK_REJECT", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(REJECT_ADDRESSES.TC_1),
        MOCK_API_CALLS[REJECT_ADDRESSES.TC_1]
      );
      expect(result).to.deep.equal({
        type: "Rejection",
        reason: "Score > 80 AND phishing/theft has > 0 attributions",
      });
    });

    it("should reject TC user 4 due to MISTTRACK_RISK_REJECT", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(REJECT_ADDRESSES.TC_4),
        MOCK_API_CALLS[REJECT_ADDRESSES.TC_4]
      );
      expect(result).to.deep.equal({
        type: "Rejection",
        reason: "Score > 80 AND phishing/theft has > 0 attributions",
      });
    });

    it("should reject TC user 6 due to MISTTRACK_RISK_REJECT", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(REJECT_ADDRESSES.TC_6),
        MOCK_API_CALLS[REJECT_ADDRESSES.TC_6]
      );
      expect(result).to.deep.equal({
        type: "Rejection",
        reason: "Score > 80 AND phishing/theft has > 0 attributions",
      });
    });
    it("should reject TC user 7 due to MISTTRACK_RISK_REJECT", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(REJECT_ADDRESSES.TC_7),
        MOCK_API_CALLS[REJECT_ADDRESSES.TC_7]
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
        MOCK_API_CALLS[APPROVE_ADDRESSES.VITALIK]
      );
      expect(result.type).to.equal("Delay");
    });

    it("should approve Beiko", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(APPROVE_ADDRESSES.BEIKO),
        MOCK_API_CALLS[APPROVE_ADDRESSES.BEIKO]
      );
      expect(result.type).to.equal("Delay");
    });
    it("should approve TC user 2", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(APPROVE_ADDRESSES.TC_2),
        MOCK_API_CALLS[APPROVE_ADDRESSES.TC_2]
      );
      expect(result).to.deep.equal({
        type: "Delay",
        timeSeconds: 21600,
      });
    });
    it("should approve TC user 3", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(APPROVE_ADDRESSES.TC_3),
        MOCK_API_CALLS[APPROVE_ADDRESSES.TC_3]
      );
      expect(result).to.deep.equal({
        type: "Delay",
        timeSeconds: 21600,
      });
    });

    it("should approve TC user 5", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(APPROVE_ADDRESSES.TC_5),
        MOCK_API_CALLS[APPROVE_ADDRESSES.TC_5]
      );
      expect(result).to.deep.equal({
        type: "Delay",
        timeSeconds: 21600,
      });
    });
    it("should approve Aztec user 1", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(APPROVE_ADDRESSES.AZTEC_1),
        MOCK_API_CALLS[APPROVE_ADDRESSES.AZTEC_1]
      );
      expect(result).to.deep.equal({
        timeSeconds: 21600,
        type: "Delay",
      });
    });

    it("should approve Aztec user 2", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(APPROVE_ADDRESSES.AZTEC_2),
        MOCK_API_CALLS[APPROVE_ADDRESSES.AZTEC_2]
      );
      expect(result).to.deep.equal({
        type: "Delay",
        timeSeconds: 7200,
      });
    });

    it("should approve Aztec user 3", async () => {
      const result = await RULESET_V1.check(
        formDepositInfo(APPROVE_ADDRESSES.AZTEC_3),
        MOCK_API_CALLS[APPROVE_ADDRESSES.AZTEC_3]
      );
      expect(result).to.deep.equal({
        timeSeconds: 7200,
        type: "Delay",
      });
    });
  });
});
