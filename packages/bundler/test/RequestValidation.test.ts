import { expect } from "chai";
import { tryParseRelayRequest } from "../src/request";
import { VALID_RELAY_REQUEST } from "./utils";
import * as JSON from "bigint-json-serialization";

describe("JSON Request Validation", async () => {
  it("validates valid relay request", () => {
    const errorOrOperation = tryParseRelayRequest(VALID_RELAY_REQUEST);
    expect(typeof errorOrOperation == "string").to.be.false;
  });

  it("rejects invalid relay request", () => {
    let invalid = JSON.parse(JSON.stringify(VALID_RELAY_REQUEST));
    invalid.operation.joinSplits[0].proof[5] =
      "0xdDbD1E80090943632ED47B1632Cb36e7cA28abc2";
    invalid.operation.asset = "0n";
    const errorOrOperation = tryParseRelayRequest(invalid);
    expect(typeof errorOrOperation == "string").to.be.true;
  });
});
