import Dockerode from "dockerode";
import { sleep } from "./utils";
import { v4 as uuidv4 } from "uuid";
import findWorkspaceRoot from "find-yarn-workspace-root";

const ROOT_DIR = findWorkspaceRoot()!;

const SUBTREE_UPDATER_IMAGE = "mock-subtree-updater";

export interface SubtreeUpdaterConfig {
  handlerAddress: string;
  rpcUrl: string;
  txSignerKey: string;
}

export async function startSubtreeUpdater(
  docker: Dockerode,
  config: SubtreeUpdaterConfig
): Promise<Dockerode.Container> {
  const container = await docker.createContainer({
    Image: SUBTREE_UPDATER_IMAGE,
    name: `${SUBTREE_UPDATER_IMAGE}-${uuidv4()}`,
    Env: [`RPC_URL=${config.rpcUrl}`, `TX_SIGNER_KEY=${config.txSignerKey}`],
    Cmd: [
      `--use-mock-prover`,
      `--fill-batches`,
      `--handler-address`,
      `${config.handlerAddress}`,
      `--zkey-path`,
      `${ROOT_DIR}/circuit-artifacts/subtreeupdate/subtreeupdate_cpp/subtreeupdate.zkey`,
      `--vkey-path`,
      `${ROOT_DIR}/circuit-artifacts/subtreeupdate/subtreeupdate_cpp/vkey.json`,
      `--prover-path`,
      `${ROOT_DIR}/rapidsnark/build/prover`,
      `--witness-generator-path`,
      `${ROOT_DIR}/circuit-artifacts/subtreeupdate/subtreeupdate_cpp/subtreeupdate`,
      `--interval`,
      `${8_000}`,
    ],
    HostConfig: {
      ExtraHosts: ["host.docker.internal:host-gateway"],
    },
  });
  await container.start();
  console.log("Started subtree updater");
  await sleep(3_000);
  return container;
}
