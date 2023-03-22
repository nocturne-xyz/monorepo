import * as envfile from "envfile";
import { sleep } from "./utils";
import * as fs from "fs";
import findWorkspaceRoot from "find-yarn-workspace-root";
import * as compose from "docker-compose";

const ROOT_DIR = findWorkspaceRoot()!;

const SCREENER_COMPOSE_CWD = `${ROOT_DIR}/packages/deposit-screener`;
const SCREENER_ENV_FILE_PATH = `${ROOT_DIR}/packages/deposit-screener/.env`;
const SCREENER_COMPOSE_OPTS: compose.IDockerComposeOptions = {
  cwd: SCREENER_COMPOSE_CWD,
  commandOptions: [["--build"], ["--force-recreate"], ["--renew-anon-volumes"]],
  log: true,
};

export interface DepositScreenerConfig {
  redisUrl: string;
  redisPassword: string;
  depositManagerAddress: string;
  subgraphUrl: string;
  rpcUrl: string;
  attestationSignerKey: string;
  txSignerKey: string;
}

export async function startDepositScreener(
  config: DepositScreenerConfig
): Promise<void> {
  const {
    redisUrl,
    redisPassword,
    depositManagerAddress,
    subgraphUrl,
    rpcUrl,
    attestationSignerKey,
    txSignerKey,
  } = config;

  const envFile = envfile.stringify({
    REDIS_URL: redisUrl,
    REDIS_PASSWORD: redisPassword,
    DEPOSIT_MANAGER_ADDRESS: depositManagerAddress,
    SUBGRAPH_URL: subgraphUrl,
    RPC_URL: rpcUrl,
    ATTESTATION_SIGNER_KEY: attestationSignerKey,
    TX_SIGNER_KEY: txSignerKey,
  });

  // TODO: figure out how to NOT override deposit-screener/.env, using --env-file didn't
  // work
  console.log("Writing to screener env file:\n", envFile);
  fs.writeFileSync(SCREENER_ENV_FILE_PATH, envFile);
  await compose.upAll(SCREENER_COMPOSE_OPTS);
  await sleep(3_000);
}

export async function stopDepositScreener(): Promise<void> {
  await compose.down({
    cwd: SCREENER_COMPOSE_CWD,
    commandOptions: [["--volumes"]],
  });
}
