import "mocha";
import { expect } from "chai";
import { NocturneConfig, loadNocturneConfig } from "../src/index";
import * as fs from "fs";
import findWorkspaceRoot from "find-yarn-workspace-root";

const ROOT_DIR = findWorkspaceRoot()!;

describe("Config", async () => {
  it("loads example config", () => {
    const config = loadNocturneConfig("example-network");

    console.log(config);
    expect(config.contracts.network).to.not.be.undefined;
    expect(config.contracts.startBlock).to.not.be.undefined;
    expect(config.contracts.owners).to.not.be.undefined;
    expect(config.contracts.proxyAdmin).to.not.be.undefined;
    expect(config.contracts.depositManagerProxy).to.not.be.undefined;
    expect(config.contracts.tellerProxy).to.not.be.undefined;
    expect(config.contracts.handlerProxy).to.not.be.undefined;
    expect(config.contracts.joinSplitVerifierAddress).to.not.be.undefined;
    expect(config.contracts.subtreeUpdateVerifierAddress).to.not.be.undefined;
    expect(config.contracts.depositSources).to.not.be.undefined;
    expect(config.contracts.screeners).to.not.be.undefined;
    expect(config.erc20s.size).to.be.greaterThan(0);
    expect(config.protocolAllowlist.size).to.be.greaterThan(0);
  });

  it("loads sepolia config", () => {
    const config = loadNocturneConfig("sepolia");

    console.log(config);
    expect(config.contracts.network).to.not.be.undefined;
    expect(config.contracts.startBlock).to.not.be.undefined;
    expect(config.contracts.owners).to.not.be.undefined;
    expect(config.contracts.proxyAdmin).to.not.be.undefined;
    expect(config.contracts.depositManagerProxy).to.not.be.undefined;
    expect(config.contracts.tellerProxy).to.not.be.undefined;
    expect(config.contracts.handlerProxy).to.not.be.undefined;
    expect(config.contracts.joinSplitVerifierAddress).to.not.be.undefined;
    expect(config.contracts.subtreeUpdateVerifierAddress).to.not.be.undefined;
    expect(config.contracts.depositSources).to.not.be.undefined;
    expect(config.contracts.screeners).to.not.be.undefined;
    expect(config.erc20s.size).to.be.greaterThan(0);
    expect(config.protocolAllowlist.size).to.be.greaterThan(0);
  });

  it("serializes/deserializes config", () => {
    const config = loadNocturneConfig("example-network");
    const json = fs
      .readFileSync(`${ROOT_DIR}/packages/config/configs/example-network.json`)
      .toString();
    const fromJSONConfig = NocturneConfig.fromString(json);
    expect(fromJSONConfig).to.deep.equal(config);
  });
});
