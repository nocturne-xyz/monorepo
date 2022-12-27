import { expect } from "chai";
import { spawn } from "child_process";
import findWorkspaceRoot from "find-yarn-workspace-root";

import RedisMemoryServer from "redis-memory-server";

const PORT = 3000;
const WALLET_ADDRESS = "0xE706317bf66b1C741CfCa5dCf5B78A44B5eD79e0";

const ROOT_DIR = findWorkspaceRoot()!;
const BUNDLER_CLI_PATH = `${ROOT_DIR}/packages/bundler/src/cli/index.ts`;

describe("Bundler CLI", async () => {
  let redisServer: RedisMemoryServer;

  beforeEach(async () => {
    redisServer = await RedisMemoryServer.create();
    const port = await redisServer.getPort();

    process.env.REDIS_URL = `localhost:${port}`;
    process.env.RPC_URL = "http://localhost:8545";
    process.env.TX_SIGNER_KEY =
      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
  });

  async function executeCmdAndGetStdout(cmdArray: any[]): Promise<string> {
    return await new Promise<string>((resolve) => {
      const child = spawn(cmdArray[0], cmdArray.slice(1), { shell: true });
      child.stdout.on("data", (data) => {
        resolve(data.toString());
      });
    });
  }

  it("`run server` command succeeds", async () => {
    const stdout = await executeCmdAndGetStdout([
      `npx`,
      `ts-node`,
      `${BUNDLER_CLI_PATH}`,
      `run`,
      `server`,
      `--wallet-address`,
      `${WALLET_ADDRESS}`,
      `--port`,
      `${PORT}`,
    ]);
    expect(stdout.includes("Bundler server listening")).to.be.true;
  });

  it("`run batcher` command succeeds", async () => {
    const stdout = await executeCmdAndGetStdout([
      `npx`,
      `ts-node`,
      `${BUNDLER_CLI_PATH}`,
      `run`,
      `batcher`,
    ]);
    expect(stdout.includes("Batcher running")).to.be.true;
  });

  it("`run submitter` command succeeds", async () => {
    const stdout = await executeCmdAndGetStdout([
      `npx`,
      `ts-node`,
      `${BUNDLER_CLI_PATH}`,
      `run`,
      `submitter`,
      `--wallet-address`,
      `${WALLET_ADDRESS}`,
    ]);
    expect(stdout.includes("Submitter running")).to.be.true;
  });
});
