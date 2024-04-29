import { loadNocturneConfig, NocturneConfig } from "@nocturne-xyz/config";
import {
  Handler,
  Handler__factory,
  Teller,
  Teller__factory,
} from "@nocturne-xyz/contracts";
import * as ethers from "ethers";
import { startSubtreeUpdater, SubtreeUpdaterConfig } from "./subtreeUpdater";
import { InsertionWriterConfig, startInsertionWriter } from "./insertionWriter";
import { sleep, SUBGRAPH_URL, TeardownFn } from "../utils";
import { getEnvVars } from "../env";
import { startSubgraph } from "./subgraph";

export * from "../env";
export * from "./insertionWriter";
export * from "./redis";
export * from "./subgraph";
export * from "./subtreeUpdater";

export interface EejectorDeployment {
  teller: Teller;
  handler: Handler;
  config: NocturneConfig;
  eoa: ethers.Wallet;

  fillSubtreeBatch: () => Promise<void>;
  teardown: () => Promise<void>;
}

const SUBTREE_UPDATER_CONFIG = (
  rpcUrl: string,
  handlerAddress: string,
  txSignerKey: string
): SubtreeUpdaterConfig => ({
  rpcUrl,
  subgraphUrl: SUBGRAPH_URL,
  fillBatchLatency: undefined,
  handlerAddress,
  txSignerKey,
  // useRapidsnark: true,
});

const INSERTION_WRITER_CONFIG: InsertionWriterConfig = {
  subgraphUrl: SUBGRAPH_URL,
};

export type SetupOptions = {
  networkNameOrConfigPath: string;
  updateTree: boolean;
};

export async function setupEjectorDeployment(
  options: Partial<SetupOptions> = {}
): Promise<EejectorDeployment> {
  const networkNameOrConfigPath = options.networkNameOrConfigPath ?? "mainnet";
  const updateTree = options.updateTree ?? false;

  const { RPC_URL, SPEND_PRIVATE_KEY, WITHDRAWAL_EOA_PRIVATE_KEY } =
    getEnvVars();

  // setup ethers provider and eoa wallet
  const provider = new ethers.providers.JsonRpcProvider({
    url: RPC_URL,
    timeout: 300_000,
  });
  const eoa = new ethers.Wallet(SPEND_PRIVATE_KEY, provider);

  // get contract instances
  const contractConfig = loadNocturneConfig(networkNameOrConfigPath);
  const tellerAddress = contractConfig.contracts.handlerProxy.proxy;
  const handlerAddress = contractConfig.contracts.tellerProxy.proxy;
  const [teller, handler] = await Promise.all([
    Teller__factory.connect(tellerAddress, eoa),
    Handler__factory.connect(handlerAddress, eoa),
  ]);

  const teardownFns: TeardownFn[] = [];

  // deploy subgraph
  const teardownSubgraph = await startSubgraph();
  teardownFns.push(teardownSubgraph);

  // if updateTree is true, deploy subtree updater + insertion writer using the withdrawal EOA as the tx signer
  if (updateTree) {
    // deploy subtree updater
    const teardownSubtreeUpdater = await startSubtreeUpdater(
      SUBTREE_UPDATER_CONFIG(
        RPC_URL,
        handlerAddress,
        WITHDRAWAL_EOA_PRIVATE_KEY
      )
    );
    teardownFns.push(teardownSubtreeUpdater);

    // deploy insertion writer
    const teardownInsertionWriter = await startInsertionWriter(
      INSERTION_WRITER_CONFIG
    );
    teardownFns.push(teardownInsertionWriter);
  }

  const teardown = async () => {
    for (const fn of teardownFns) {
      await fn();
    }
  };

  const fillSubtreeBatch = async () => {
    try {
      console.log("filling batch with zeros...");
      const tx = await handler.fillBatchWithZeros();
      await tx.wait(1);
    } catch (err: any) {
      // if we get revert due to batch already being organically filled, ignore the error
      if (!err.toString().includes("!zero fill empty batch")) {
        console.error("error filling batch:", err);
        throw err;
      }
    }

    // wait for subgraph / subtree updater
    console.log("waiting for tree update. this may take a few minutes...");
    // TODO - listen for subtree update event on teller contract instead
    await sleep(300_000);
  };

  return {
    teller,
    handler,
    config: contractConfig,
    eoa,
    fillSubtreeBatch: updateTree
      ? fillSubtreeBatch
      : async () => {
          console.log(
            "skipping fillSubtreeBatch - the `update-tree` flag is set to false"
          );
        },
    teardown,
  };
}
