import "mocha";
import { expect } from "chai";
import { loadNocturneConfig } from "../src/index";
import * as fs from "fs";
import * as JSON from "bigint-json-serialization";

describe("BundlerBatcher", async () => {
  it("Loads example config", () => {
    const jsonConfig = JSON.parse(
      fs.readFileSync(`${__dirname}/../configs/example-network.json`).toString()
    );
    const config = loadNocturneConfig("example-network");

    expect(jsonConfig.contracts).to.eql(config.contracts);
    expect(config.gasAssets.get("weth")!).to.eql(jsonConfig.gasAssets.weth);
    expect(config.gasAssets.get("dai")!).to.eql(jsonConfig.gasAssets.dai);
    expect(config.rateLimits.get("weth")!).to.eql(jsonConfig.rateLimits.weth);
    expect(config.rateLimits.get("dai")!).to.eql(jsonConfig.rateLimits.dai);
  });
});
