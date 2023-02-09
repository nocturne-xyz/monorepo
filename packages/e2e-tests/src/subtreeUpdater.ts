import Dockerode from "dockerode";
import { sleep } from "./utils";
import findWorkspaceRoot from "find-yarn-workspace-root";

const ROOT_DIR = findWorkspaceRoot()!;

const SUBTREE_UPDATER_IMAGE = "docker.io/library/mock-subtree-updater";
const SUBTREE_UPDATER_NAME = "mock-subtree-updater";

interface SubtreeUpdaterConfig {
  walletAddress: string;
  rpcUrl: string;
  txSignerKey: string;
}

export async function startSubtreeUpdater(
  docker: Dockerode,
  config: SubtreeUpdaterConfig
): Promise<Dockerode.Container> {
  const container = await docker.createContainer({
    Image: SUBTREE_UPDATER_IMAGE,
    name: SUBTREE_UPDATER_NAME,
    Env: [`RPC_URL=${config.rpcUrl}`, `TX_SIGNER_KEY=${config.txSignerKey}`],
    Cmd: [
      `--use-mock-prover`,
      `--fill-batches`,
      `--wallet-address`,
      `${config.walletAddress}`,
      `--zkey-path`,
      `${ROOT_DIR}/circuit-artifacts/subtreeupdate/subtreeupdate_cpp/subtreeupdate.zkey`,
      `--vkey-path`,
      `${ROOT_DIR}/circuit-artifacts/subtreeupdate/subtreeupdate_cpp/vkey.json`,
      `--prover-path`,
      `${ROOT_DIR}/rapidsnark/build/prover`,
      `--witness-generator-path`,
      `${ROOT_DIR}/circuit-artifacts/subtreeupdate/subtreeupdate_cpp/subtreeupdate`,
    ],
  });
  await container.start();
  console.log("Started subtree updater");
  await sleep(3_000);
  return container;
}
