import { expect } from "chai";
import { extractRelayError } from "../src/validation";
import { VALID_PROVEN_OPERATION_OBJ } from "./utils";

describe("JSON Request Validation", async () => {
  it("Validates valid relay request", () => {
    const maybeError = extractRelayError(VALID_PROVEN_OPERATION_OBJ);
    console.log(maybeError);
    expect(maybeError).to.be.undefined;
  });

  it("Rejects invalid relay request", () => {
    let invalid = JSON.parse(JSON.stringify(VALID_PROVEN_OPERATION_OBJ));
    invalid.joinSplitTxs[0].proof[5] = "0x12345";
    invalid.asset = "0n";
    const maybeError = extractRelayError(invalid);
    expect(maybeError).to.not.be.undefined;
  });
});
