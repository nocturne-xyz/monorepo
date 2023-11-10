import "mocha";
import { expect } from "chai";
import { isSanctionedAddress } from "../src/sanctions";
import { TEST_PROVIDER } from "./utils";

// if we have trouble, pull in from env and setup env vars

describe("SanctionsList", () => {
  // sleep to avoid rate limits
  afterEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5000));
  });

  it("returns true for sanctioned address", async () => {
    // test case from chainalysis article here: https://go.chainalysis.com/chainalysis-oracle-docs.html
    const res = await isSanctionedAddress(
      TEST_PROVIDER,
      "0x7F367cC41522cE07553e823bf3be79A889DEbe1B"
    );

    expect(res).to.be.true;
  });

  it("returns false for non-sanctioned address", async () => {
    // test case from chainalysis article here: https://go.chainalysis.com/chainalysis-oracle-docs.html
    const res = await isSanctionedAddress(
      TEST_PROVIDER,
      "0x7f268357A8c2552623316e2562D90e642bB538E5"
    );

    expect(res).to.be.false;
  });
});
