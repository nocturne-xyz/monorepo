import "mocha";
import { expect } from "chai";
import { loadNocturneConfig } from "../src/index";
import * as fs from "fs";
import * as JSON from "bigint-json-serialization";

describe("Config", async () => {
  it("Loads example config", () => {
    const jsonConfig = JSON.parse(
      fs.readFileSync(`${__dirname}/../configs/example-network.json`).toString()
    );
    const config = loadNocturneConfig("example-network");

    expect(config.contracts.network).to.not.be.undefined;
    expect(config.contracts.startBlock).to.not.be.undefined;
    expect(config.contracts.owners).to.not.be.undefined;
    expect(config.contracts.proxyAdmin).to.not.be.undefined;
    expect(config.contracts.depositManagerProxy).to.not.be.undefined;
    expect(config.contracts.walletProxy).to.not.be.undefined;
    expect(config.contracts.handlerProxy).to.not.be.undefined;
    expect(config.contracts.joinSplitVerifierAddress).to.not.be.undefined;
    expect(config.contracts.subtreeUpdateVerifierAddress).to.not.be.undefined;
    expect(config.contracts.depositSources).to.not.be.undefined;
    expect(config.contracts.screeners).to.not.be.undefined;

    expect(config.gasAsset("weth")!).to.eql(jsonConfig.gasAssets.weth);
    expect(config.gasAsset("dai")!).to.eql(jsonConfig.gasAssets.dai);
    expect(config.rateLimit("weth")!).to.eql(jsonConfig.rateLimits.weth);
    expect(config.rateLimit("dai")!).to.eql(jsonConfig.rateLimits.dai);
  });
});
