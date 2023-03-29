import { expect } from "chai";
import { tryParseRelayRequest } from "../src/requestValidation";
import { VALID_PROVEN_OPERATION_OBJ } from "./utils";

describe("JSON Request Validation", async () => {
  it("validates valid relay request", () => {
    const errorOrOperation = tryParseRelayRequest(VALID_PROVEN_OPERATION_OBJ);
    expect(typeof errorOrOperation == "string").to.be.false;
  });

  it("rejects invalid relay request", () => {
    let invalid = JSON.parse(JSON.stringify(VALID_PROVEN_OPERATION_OBJ));
    invalid.joinSplits[0].proof[5] = "0x12345";
    invalid.asset = "0n";
    const errorOrOperation = tryParseRelayRequest(invalid);
    expect(typeof errorOrOperation == "string").to.be.true;
  });
});
