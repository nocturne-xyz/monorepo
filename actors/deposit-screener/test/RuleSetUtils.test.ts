import { US_TIMEZONE_DELAY_RULE } from "../src/screening/checks/v1/RULESET_V1";
import moment from "moment-timezone";
import * as sinon from "sinon";
import { DUMMY_DEPOSIT_REQUEST } from "./utils";
import { expect } from "chai";
import { FIVE_ETHER } from "../src/screening/checks/v1/utils";

describe("RuleSet Utils", async () => {
  it("checks US timezone rule", () => {
    const largeDeposit = DUMMY_DEPOSIT_REQUEST;
    largeDeposit.value = FIVE_ETHER;

    // Mock date/time to be 10pm ET (should trigger since window starts @ 9:30pm ET)
    const mockDate1 = moment
      .tz("2023-11-20 22:00:00", "America/New_York")
      .toDate();
    const clock = sinon.useFakeTimers(mockDate1.getTime());

    let triggered = US_TIMEZONE_DELAY_RULE.threshold(largeDeposit);
    expect(triggered).to.be.true;

    // Mock date/time to be 8am ET (no trigger since window ends @ 7:00am ET)
    const mockDate2 = moment
      .tz("2023-11-21 08:00:00", "America/New_York")
      .toDate();
    clock.tick(mockDate2.valueOf() - mockDate1.valueOf());

    triggered = US_TIMEZONE_DELAY_RULE.threshold(largeDeposit);
    expect(triggered).to.be.false;

    clock.restore();
  });
});
