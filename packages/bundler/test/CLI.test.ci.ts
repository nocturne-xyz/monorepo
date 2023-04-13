import { expect } from "chai";
import { spawn } from "child_process";
import * as fs from "fs";
import findWorkspaceRoot from "find-yarn-workspace-root";

import RedisMemoryServer from "redis-memory-server";
import { sleep } from "../src/utils";

const PORT = 3000;
const WALLET_ADDRESS = "0xE706317bf66b1C741CfCa5dCf5B78A44B5eD79e0";

const ROOT_DIR = findWorkspaceRoot()!;
const BUNDLER_CLI_PATH = `${ROOT_DIR}/packages/bundler/src/cli/index.ts`;

describe("Bundler CLI", async () => {
  let redisServer: RedisMemoryServer;

  before(async () => {
    redisServer = await RedisMemoryServer.create();
    const port = await redisServer.getPort();

    process.env.REDIS_URL = `localhost:${port}`;
    process.env.RPC_URL = "http://localhost:8545";
    process.env.TX_SIGNER_KEY =
      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

    // clear log dir if it exists
    const logDir = `${ROOT_DIR}/packages/bundler/test/logs`;
    if (fs.existsSync(logDir)) {
      fs.rmdirSync(logDir, { recursive: true });
    }
  });

  async function executeCmdForAHotSec(cmdArray: any[]) {
    const child = spawn(cmdArray[0], cmdArray.slice(1), { shell: true });
    await sleep(30_000);
    child.kill();
  }

  it("`run server` command succeeds", async () => {
    const logDir = `${ROOT_DIR}/packages/bundler/test/logs/bundler-server`;

    await executeCmdForAHotSec([
      `npx`,
      `ts-node`,
      `${BUNDLER_CLI_PATH}`,
      `run`,
      `server`,
      `--wallet-address`,
      `${WALLET_ADDRESS}`,
      `--port`,
      `${PORT}`,
      `--log-dir`,
      logDir,
    ]);

    const stdout = fs.readFileSync(`${logDir}/info.log`, "utf8");

    expect(stdout.includes("listening")).to.be.true;
  });

  it("`run batcher` command succeeds", async () => {
    const logDir = `${ROOT_DIR}/packages/bundler/test/logs/bundler-batcher`;

    await executeCmdForAHotSec([
      `npx`,
      `ts-node`,
      `${BUNDLER_CLI_PATH}`,
      `run`,
      `batcher`,
      `--log-dir`,
      logDir,
    ]);

    const stdout = fs.readFileSync(`${logDir}/info.log`, "utf8");
    expect(stdout.includes("starting")).to.be.true;
  });

  it("`run submitter` command succeeds", async () => {
    const logDir = `${ROOT_DIR}/packages/bundler/test/logs/bundler-submitter`;

    await executeCmdForAHotSec([
      `npx`,
      `ts-node`,
      `${BUNDLER_CLI_PATH}`,
      `run`,
      `submitter`,
      `--wallet-address`,
      `${WALLET_ADDRESS}`,
      `--log-dir`,
      logDir,
    ]);

    const stdout = fs.readFileSync(`${logDir}/info.log`, "utf8");
    expect(stdout.includes("starting")).to.be.true;
  });
});
