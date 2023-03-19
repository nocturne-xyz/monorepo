import { ethers } from "ethers";
import * as fs from "fs";
import {
  Wallet__factory,
  Vault__factory,
  Vault,
  Wallet,
  DepositManager,
  DepositManager__factory,
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
  Address,
} from "@nocturne-xyz/sdk";

import {
  checkNocturneContractDeployment,
  deployNocturne,
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
import { startSubgraph, stopSubgraph, SubgraphConfig } from "./subgraph";
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

export interface NocturneDeployArgs {
  screeners: Address[];
}

export interface TestActorsConfig {
  // specify which actors to include
  // if not given, all actors are deployed
  include: {
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
  depositManager: DepositManager;
  wallet: Wallet;
  vault: Vault;
  contractDeployment: NocturneContractDeployment;
  provider: ethers.providers.JsonRpcProvider;
  bundlerEoa: ethers.Wallet;
  subtreeUpdaterEoa: ethers.Wallet;
  teardown: () => Promise<void>;
}

// defaults for actor deployments
const HH_URL = "http://localhost:8545";
const HH_FROM_DOCKER_URL = "http://host.docker.internal:8545";

const REDIS_URL = "redis://redis:6379";
const REDIS_PASSWORD = "baka";

const DEFAULT_HH_NETWORK_CONFIG: HardhatNetworkConfig = {
  blockTime: 3_000,
  keys: KEYS,
};

const DEFAULT_BUNDLER_CONFIG: Omit<
  BundlerConfig,
  "walletAddress" | "txSignerKey"
> = {
  redisUrl: REDIS_URL,
  redisPassword: REDIS_PASSWORD,
  maxLatency: 1,
  rpcUrl: HH_FROM_DOCKER_URL,
};

const DEFAULT_SUBTREE_UPDATER_CONFIG: Omit<
  SubtreeUpdaterConfig,
  "walletAddress" | "txSignerKey"
> = {
  rpcUrl: HH_FROM_DOCKER_URL,
};

const DEFAULT_SUBGRAPH_CONFIG: Omit<SubgraphConfig, "walletAddress"> = {
  startBlock: 0,
};

const docker = new Dockerode();

// returns an async function that should be called for teardown
// if include is not given, no off-chain actors will be deployed
export async function setupTestDeployment(
  config: TestActorsConfig
): Promise<NocturneTestDeployment> {
  // hh node has to go up first,
  // then contracts,
  // then everything else can go up in any order

  // spin up hh node
  const givenHHConfig = config.configs?.hhNode ?? {};
  const hhConfig = { ...DEFAULT_HH_NETWORK_CONFIG, ...givenHHConfig };
  const hhContainer = await startHardhatNetwork(docker, hhConfig);

  // sliep while the container starts up
  await sleep(5_000);

  // deploy contracts
  const provider = new ethers.providers.JsonRpcProvider(HH_URL);
  const [deployerEoa, aliceEoa, bobEoa, bundlerEoa, subtreeUpdaterEoa] =
    KEYS_TO_WALLETS(provider);
  const contractDeployment = await deployContractsWithDummyAdmins(deployerEoa, {
    screeners: [aliceEoa.address, bobEoa.address], // TODO: remove once we have designated screener actor
  });

  await checkNocturneContractDeployment(
    contractDeployment,
    deployerEoa.provider
  );

  const { depositManagerProxy, walletProxy, vaultProxy } = contractDeployment;
  const [depositManager, wallet, vault] = await Promise.all([
    DepositManager__factory.connect(depositManagerProxy.proxy, deployerEoa),
    Wallet__factory.connect(walletProxy.proxy, deployerEoa),
    Vault__factory.connect(vaultProxy.proxy, deployerEoa),
  ]);

  // deploy everything else
  const proms = [];

  if (config.include?.bundler) {
    const givenBundlerConfig = config.configs?.bundler ?? {};
    const bundlerConfig = {
      ...DEFAULT_BUNDLER_CONFIG,
      ...givenBundlerConfig,
      walletAddress: walletProxy.proxy,
      txSignerKey: bundlerEoa.privateKey,
    };

    proms.push(startBundler(bundlerConfig));
  }

  let subtreeUpdaterContainer: Dockerode.Container | undefined;
  if (config.include?.subtreeUpdater) {
    const givenSubtreeUpdaterConfig = config.configs?.subtreeUpdater ?? {};
    const subtreeUpdaterConfig = {
      ...DEFAULT_SUBTREE_UPDATER_CONFIG,
      ...givenSubtreeUpdaterConfig,
      walletAddress: walletProxy.proxy,
      txSignerKey: subtreeUpdaterEoa.privateKey,
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

  if (config.include?.subgraph) {
    const givenSubgraphConfig = config.configs?.subgraph ?? {};
    const subgraphConfig = {
      ...DEFAULT_SUBGRAPH_CONFIG,
      ...givenSubgraphConfig,
      walletAddress: walletProxy.proxy,
    };

    proms.push(startSubgraph(subgraphConfig));
  }

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

    if (config.include?.bundler) {
      proms.push(stopBundler());
    }

    if (config.include?.subgraph) {
      proms.push(stopSubgraph());
    }

    await Promise.all(proms);

    // wait for all of the actors to finish teardown before tearing down hh node
    await sleep(10_000);

    // teardown hh node
    await hhContainer.stop();
    await hhContainer.remove();

    // wait a bit to ensure hh node is torn down before next test is allowed to run
    await sleep(5_000);
  };

  return {
    depositManager,
    wallet,
    vault,
    contractDeployment,
    provider,
    teardown,
    bundlerEoa,
    subtreeUpdaterEoa,
  };
}

export async function deployContractsWithDummyAdmins(
  connectedSigner: ethers.Wallet,
  args: NocturneDeployArgs
): Promise<NocturneContractDeployment> {
  const deployment = await deployNocturne(
    connectedSigner,
    {
      proxyAdminOwner: "0x3CACa7b48D0573D793d3b0279b5F0029180E83b6",
      walletOwner: "0x3CACa7b48D0573D793d3b0279b5F0029180E83b6",
      depositManagerOwner: "0x3CACa7b48D0573D793d3b0279b5F0029180E83b6",
      screeners: args.screeners,
    },
    {
      useMockSubtreeUpdateVerifier:
        process.env.ACTUALLY_PROVE_SUBTREE_UPDATE == undefined,
      confirmations: 1,
    }
  );

  // Log for dev site script
  console.log("Wallet address:", deployment.walletProxy.proxy);
  console.log("Vault address:", deployment.vaultProxy.proxy);
  console.log("DepositManager address:", deployment.depositManagerProxy.proxy);
  return deployment;
}

export interface SetupNocturneOpts {
  syncAdapter?: SyncAdapterOption;
  gasAssets?: Map<string, string>;
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
    opts?.gasAssets ?? new Map(Object.entries({})),
    new Map(Object.entries({}))
  );

  const { walletProxy } = contractDeployment;
  const wallet = Wallet__factory.connect(walletProxy.proxy, provider);

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
