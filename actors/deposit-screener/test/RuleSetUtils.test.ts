import { US_TIMEZONE_DELAY_RULE } from "../src/screening/checks/v1/RULESET_V1";
import moment from "moment-timezone";
import * as sinon from "sinon";
import { DUMMY_DEPOSIT_REQUEST } from "./utils";
import { expect } from "chai";

describe("RuleSet Utils", async () => {
  it("checks US timezone rule", () => {
    // Mock date/time to be 10pm ET (should trigger since window starts @ 9:30pm ET)
    const mockDate = moment
      .tz("2023-11-20 22:00:00", "America/New_York")
      .toDate();
    const clock1 = sinon.useFakeTimers(mockDate.getTime());

    let triggered = US_TIMEZONE_DELAY_RULE.threshold(DUMMY_DEPOSIT_REQUEST);
    expect(triggered).to.be.true;

    clock1.restore();

    // Mock date/time to be 8am ET (no trigger since window ends @ 7:00am ET)
    const mockDate2 = moment
      .tz("2023-11-20 08:00:00", "America/New_York")
      .toDate();
    const clock2 = sinon.useFakeTimers(mockDate2.getTime());

    triggered = US_TIMEZONE_DELAY_RULE.threshold(DUMMY_DEPOSIT_REQUEST);
    expect(triggered).to.be.false;

    clock2.restore();
  });
});
