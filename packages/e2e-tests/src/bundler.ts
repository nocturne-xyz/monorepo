import * as envfile from "envfile";
import { sleep } from "./utils";
import * as fs from "fs";
import findWorkspaceRoot from "find-yarn-workspace-root";
import * as compose from "docker-compose";

const ROOT_DIR = findWorkspaceRoot()!;

const BUNDLER_ENV_FILE_PATH = `${ROOT_DIR}/packages/bundler/.env`;
export const BUNDLER_COMPOSE_OPTS: compose.IDockerComposeOptions = {
  cwd: `${ROOT_DIR}/packages/bundler`,
  commandOptions: [["--build"]],
};

interface BundlerConfig {
  redisUrl: string;
  redisPassword: string;
  walletAddress: string;
  maxLatency: number;
  rpcUrl: string;
  txSignerKey: string;
}

export async function startBundler(config: BundlerConfig): Promise<void> {
  const {
    redisUrl,
    redisPassword,
    walletAddress,
    maxLatency,
    rpcUrl,
    txSignerKey,
  } = config;

  const envFile = envfile.stringify({
    REDIS_URL: redisUrl,
    REDIS_PASSWORD: redisPassword,
    WALLET_ADDRESS: walletAddress,
    MAX_LATENCY: maxLatency,
    RPC_URL: rpcUrl,
    TX_SIGNER_KEY: txSignerKey,
  });

  // TODO: figure out how to not override bundler/.env
  console.log("Writing to bundler env file:\n", envFile);
  fs.writeFileSync(BUNDLER_ENV_FILE_PATH, envFile);
  await compose.upAll(BUNDLER_COMPOSE_OPTS);
  await sleep(3_000);
}
