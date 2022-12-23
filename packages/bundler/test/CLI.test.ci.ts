import { expect } from "chai";
import { exec, ExecException } from "child_process";
import findWorkspaceRoot from "find-yarn-workspace-root";

import RedisMemoryServer from "redis-memory-server";
import { sleep } from "../src/utils";

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

  it("`run server` command succeeds", async () => {
    let error: ExecException | null | undefined;
    exec(
      `npx ts-node ${BUNDLER_CLI_PATH} run server --wallet-address ${WALLET_ADDRESS} --port ${PORT}`,
      (err) => {
        error = err;
      }
    );

    await sleep(15000);
    console.log(error);
    expect(error!).to.be.undefined;
  });

  it("`run batcher` command succeeds", async () => {
    let error: ExecException | null | undefined;
    exec(`npx ts-node ${BUNDLER_CLI_PATH} run batcher`, (err) => {
      error = err;
    });

    await sleep(15000);
    expect(error!).to.be.undefined;
  });

  it("`run submitter` command succeeds", async () => {
    let error: ExecException | null | undefined;
    exec(`npx ts-node ${BUNDLER_CLI_PATH} run batcher`, (err) => {
      error = err;
    });

    await sleep(15000);
    expect(error!).to.be.undefined;
  });
});
