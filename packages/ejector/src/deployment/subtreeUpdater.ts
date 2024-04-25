import { SubtreeUpdater } from "@nocturne-xyz/subtree-updater";
import { thunk } from "@nocturne-xyz/core";
import { ethers } from "ethers";
import {
  EthersTxSubmitter,
  makeTestLogger,
} from "@nocturne-xyz/offchain-utils";
import { Handler__factory } from "@nocturne-xyz/contracts";
import { makeRedisInstance } from "./redis";
import { WasmSubtreeUpdateProver } from "@nocturne-xyz/local-prover";
import { ARTIFACTS_DIR } from "../utils";

const WASM_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate.wasm`;
const ZKEY_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate.zkey`;
const VKEY_PATH = `${ARTIFACTS_DIR}/subtreeupdate/vkey.json`;

export interface SubtreeUpdaterConfig {
  handlerAddress: string;
  rpcUrl: string;
  subgraphUrl: string;
  txSignerKey: string;
  fillBatchLatency?: number;
}

const { getRedis, clearRedis, getRedisServer } = makeRedisInstance();

export const getInsertionLogRedisServer = thunk(async () => {
  return await getRedisServer();
});

export async function startSubtreeUpdater(
  config: SubtreeUpdaterConfig
): Promise<() => Promise<void>> {
  const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
  const txSubmitter = new EthersTxSubmitter(
    new ethers.Wallet(config.txSignerKey, provider)
  );
  const logger = makeTestLogger("subtree-updater", "subtree-updater");
  const handlerContract = Handler__factory.connect(
    config.handlerAddress,
    provider
  );
  const prover = new WasmSubtreeUpdateProver(WASM_PATH, ZKEY_PATH, VKEY_PATH);
  const updater = new SubtreeUpdater(
    handlerContract,
    txSubmitter,
    logger,
    await getRedis(),
    prover,
    config.subgraphUrl,
    {
      fillBatchLatency: config.fillBatchLatency,
    }
  );

  const { promise, teardown } = await updater.start();

  return async () => {
    await teardown();
    await promise;
    await clearRedis();
  };
}
