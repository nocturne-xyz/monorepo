import { ethers } from "ethers";
import * as fs from "fs";
import {
  Wallet__factory,
  Vault__factory,
  Vault,
  Wallet,
} from "@nocturne-xyz/contracts";

import {
  NocturneSigner,
  NocturneWalletSDK,
  InMemoryKVStore,
  NocturneDB,
  InMemoryMerkleProver,
  JoinSplitProver,
  RPCSyncAdapter,
  SyncAdapter,
  SubgraphSyncAdapter,
} from "@nocturne-xyz/sdk";

import {
  checkNocturneContractDeployment,
  NocturneDeployer,
} from "@nocturne-xyz/deploy";

import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
import { WasmJoinSplitProver } from "@nocturne-xyz/local-prover";
import {
  NocturneConfig,
  NocturneContractDeployment,
} from "@nocturne-xyz/config";
import { HardhatNetworkConfig, startHardhatNetwork } from "./hardhat";
import { BundlerConfig, startBundler, stopBundler } from "./bundler";
import { startSubtreeUpdater, SubtreeUpdaterConfig } from "./subtreeUpdater";
// import { startSubgraph, stopSubgraph, SubgraphConfig } from "./subgraph";
import { SubgraphConfig } from "./subgraph";
import { KEYS, KEYS_TO_WALLETS } from "./keys";
import Dockerode from "dockerode";
import { sleep } from "./utils";

// eslint-disable-next-line
const ROOT_DIR = findWorkspaceRoot()!;
const ARTIFACTS_DIR = path.join(ROOT_DIR, "circuit-artifacts");
const WASM_PATH = `${ARTIFACTS_DIR}/joinsplit/joinsplit_js/joinsplit.wasm`;
const ZKEY_PATH = `${ARTIFACTS_DIR}/joinsplit/joinsplit_cpp/joinsplit.zkey`;
const VKEY_PATH = `${ARTIFACTS_DIR}/joinsplit/joinsplit_cpp/vkey.json`;
const VKEY = JSON.parse(fs.readFileSync(VKEY_PATH).toString());
const SUBGRAPH_API_URL = "http://127.0.0.1:8000/subgraphs/name/nocturne-test";

export interface TestActorsConfig {
  // specify which actors to skip
  // by default, all actors are deployed
  skip?: {
    bundler?: boolean;
    subtreeUpdater?: boolean;
    subgraph?: boolean;
  };

  // specify configs for actors to deploy
  // if non-skipped actors don't have a config, one of the defaults below will be used
  configs?: {
    hhNode: Partial<HardhatNetworkConfig>;
    bundler: Partial<BundlerConfig>;
    subtreeUpdater: Partial<SubtreeUpdaterConfig>;
    subgraph: Partial<SubgraphConfig>;
  };
}

export interface NocturneTestDeployment {
  wallet: Wallet;
  vault: Vault;
  contractDeployment: NocturneContractDeployment;
  provider: ethers.providers.JsonRpcProvider;
  deployer: NocturneDeployer;
  teardown: () => Promise<void>;
}

// defaults for actor deployments

const HH_URL = "http://localhost:8545";
const HH_FROM_DOCKER_URL = "http://host.docker.internal:8545";

const REDIS_URL = "redis://redis:6379";
const REDIS_PASSWORD = "baka";

const defaultHardhatNetworkConfig: HardhatNetworkConfig = {
  blockTime: 3_000,
  keys: KEYS,
};

const defaultBundlerConfig: Omit<
  BundlerConfig,
  "walletAddress" | "txSignerKey"
> = {
  redisUrl: REDIS_URL,
  redisPassword: REDIS_PASSWORD,
  maxLatency: 1,
  rpcUrl: HH_FROM_DOCKER_URL,
};

const defaultSubtreeUpdaterConfig: Omit<
  SubtreeUpdaterConfig,
  "walletAddress" | "txSignerKey"
> = {
  rpcUrl: HH_FROM_DOCKER_URL,
};

const defaultSubgraphConfig: Omit<SubgraphConfig, "walletAddress"> = {
  startBlock: 0,
};

const docker = new Dockerode();

// returns an async function that should be called for teardown
//
export async function setupTestDeployment(
  config?: TestActorsConfig
): Promise<NocturneTestDeployment> {
  // wait a bit to ensure old hardhat is torn down before this one goes up
  // sometimes docker doesn't actually deallocate the port until a bit after dockerode says container is stopped
  await sleep(5000);

  // hh node has to go up first,
  // then contracts,
  // then everything else can go up in any order

  // spin up hh node
  const givenHHConfig = config?.configs?.hhNode ?? {};
  const hhConfig = { ...defaultHardhatNetworkConfig, ...givenHHConfig };
  const hhContainer = await startHardhatNetwork(docker, hhConfig);

  // deploy contracts
  const provider = new ethers.providers.JsonRpcProvider(HH_URL);
  const [deployerEoa] = KEYS_TO_WALLETS(provider);
  const deployer = new NocturneDeployer(deployerEoa);
  const contractDeployment = await deployContractsWithDummyAdmin(deployer);

  await checkNocturneContractDeployment(
    contractDeployment,
    deployer.connectedSigner.provider
  );

  const { walletProxy, vaultProxy } = contractDeployment;
  const [wallet, vault] = await Promise.all([
    Wallet__factory.connect(walletProxy.proxy, deployerEoa),
    Vault__factory.connect(vaultProxy.proxy, deployerEoa),
  ]);

  // deploy everything else
  const proms = [];

  if (!config?.skip?.bundler) {
    const givenBundlerConfig = config?.configs?.bundler ?? {};
    const bundlerConfig = {
      ...defaultBundlerConfig,
      ...givenBundlerConfig,
      walletAddress: walletProxy.proxy,
      txSignerKey: deployer.connectedSigner.privateKey,
    };

    proms.push(startBundler(bundlerConfig));
  }

  let subtreeUpdaterContainer: Dockerode.Container | undefined;
  if (!config?.skip?.subtreeUpdater) {
    const givenSubtreeUpdaterConfig = config?.configs?.subtreeUpdater ?? {};
    const subtreeUpdaterConfig = {
      ...defaultSubtreeUpdaterConfig,
      ...givenSubtreeUpdaterConfig,
      walletAddress: walletProxy.proxy,
      txSignerKey: deployer.connectedSigner.privateKey,
    };

    const startContainerWithLogs = async () => {
      const container = await startSubtreeUpdater(docker, subtreeUpdaterConfig);
      container.logs(
        { follow: true, stdout: true, stderr: true },
        (err, stream) => {
          if (err) {
            console.error(err);
            return;
          }

          stream!.pipe(process.stdout);
        }
      );

      subtreeUpdaterContainer = container;
    };

    proms.push(startContainerWithLogs());
  }

  // if (!config?.skip?.subgraph) {
  //   const givenSubgraphConfig = config?.configs?.subgraph ?? {};
  //   const subgraphConfig = {
  //     ...defaultSubgraphConfig,
  //     ...givenSubgraphConfig,
  //     walletAddress: walletProxy.proxy,
  //   };

  //   proms.push(startSubgraph(subgraphConfig));
  // }

  await Promise.all(proms);

  const teardown = async () => {
    // teardown offchain actors
    const proms = [];

    if (subtreeUpdaterContainer) {
      const teardown = async () => {
        await subtreeUpdaterContainer?.stop();
        await subtreeUpdaterContainer?.remove();
      };
      proms.push(teardown());
    }

    if (!config?.skip?.bundler) {
      proms.push(stopBundler());
    }

    // if (!config?.skip?.subgraph) {
    //   proms.push(stopSubgraph());
    // }

    await Promise.all(proms);

    // teardown hh node
    await hhContainer.stop();
    await hhContainer.remove();

    // sleep for a bit for good measure
    await sleep(3_000);
  };

  return {
    wallet,
    vault,
    contractDeployment,
    provider,
    deployer,
    teardown,
  };
}

export async function deployContractsWithDummyAdmin(
  deployer: NocturneDeployer
): Promise<NocturneContractDeployment> {
  return await deployer.deployNocturne(
    "0x3CACa7b48D0573D793d3b0279b5F0029180E83b6", // dummy
    {
      useMockSubtreeUpdateVerifier:
        process.env.ACTUALLY_PROVE_SUBTREE_UPDATE == undefined,
      confirmations: 1,
    }
  );
}

export interface SetupNocturneOpts {
  syncAdapter: SyncAdapterOption;
}

export enum SyncAdapterOption {
  RPC,
  SUBGRAPH,
}

export interface NocturneClientSetup {
  nocturneDBAlice: NocturneDB;
  nocturneWalletSDKAlice: NocturneWalletSDK;
  nocturneDBBob: NocturneDB;
  nocturneWalletSDKBob: NocturneWalletSDK;
  joinSplitProver: JoinSplitProver;
}

export async function setupTestClient(
  contractDeployment: NocturneContractDeployment,
  provider: ethers.providers.Provider,
  opts?: SetupNocturneOpts
): Promise<NocturneClientSetup> {
  const config = new NocturneConfig(
    contractDeployment,
    // TODO: fill with real assets and rate limits in SDK gas asset and deposit
    // screener PRs
    new Map(Object.entries({})),
    new Map(Object.entries({}))
  );

  const { walletProxy, vaultProxy } = contractDeployment;
  const wallet = Wallet__factory.connect(walletProxy.proxy, provider);
  const vault = Vault__factory.connect(vaultProxy.proxy, provider);

  let syncAdapter: SyncAdapter;
  if (opts?.syncAdapter && opts.syncAdapter === SyncAdapterOption.SUBGRAPH) {
    syncAdapter = new SubgraphSyncAdapter(SUBGRAPH_API_URL);
  } else {
    syncAdapter = new RPCSyncAdapter(provider, wallet.address);
  }

  console.log("Create NocturneWalletSDKAlice");
  const aliceKV = new InMemoryKVStore();
  const nocturneDBAlice = new NocturneDB(aliceKV);
  const nocturneWalletSDKAlice = setupNocturneWalletSDK(
    3n,
    config,
    provider,
    nocturneDBAlice,
    syncAdapter
  );

  console.log("Create NocturneWalletSDKBob");
  const bobKV = new InMemoryKVStore();
  const nocturneDBBob = new NocturneDB(bobKV);
  const nocturneWalletSDKBob = setupNocturneWalletSDK(
    5n,
    config,
    provider,
    nocturneDBBob,
    syncAdapter
  );

  const joinSplitProver = new WasmJoinSplitProver(WASM_PATH, ZKEY_PATH, VKEY);

  console.log("Wallet address:", wallet.address);
  console.log("Vault address:", vault.address);
  return {
    nocturneDBAlice,
    nocturneWalletSDKAlice,
    nocturneDBBob,
    nocturneWalletSDKBob,
    joinSplitProver,
  };
}

function setupNocturneWalletSDK(
  sk: bigint,
  config: NocturneConfig,
  provider: ethers.providers.Provider,
  nocturneDB: NocturneDB,
  syncAdapter: SyncAdapter
): NocturneWalletSDK {
  const nocturneSigner = new NocturneSigner(sk);
  const merkleProver = new InMemoryMerkleProver();

  return new NocturneWalletSDK(
    nocturneSigner,
    provider,
    config,
    merkleProver,
    nocturneDB,
    syncAdapter
  );
}
