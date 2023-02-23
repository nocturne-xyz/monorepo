import "mocha";
import { expect } from "chai";
import { NocturneViewer, StealthAddressTrait } from "../src/crypto";
import { generateRandomViewingKey } from "./utils";

describe("SteathAddressTrait", () => {
  const vk = generateRandomViewingKey();
  const viewer = new NocturneViewer(vk);

  it("can sererialize/deserialze addresses", () => {
    const addr = viewer.generateRandomStealthAddress();
    const str = StealthAddressTrait.toString(addr);
    expect(StealthAddressTrait.fromString(str)).to.eql(addr);
  });

  it("can re-randomize random stealth addresses", () => {
    const addr1 = viewer.generateRandomStealthAddress();
    const addr2 = StealthAddressTrait.randomize(addr1);

    expect(viewer.isOwnAddress(addr1)).to.equal(true);
    expect(viewer.isOwnAddress(addr2)).to.equal(true);
  });
});
