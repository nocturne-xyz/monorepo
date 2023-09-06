import { ethers } from "ethers";
import * as fs from "fs";
import {
  Teller__factory,
  Handler__factory,
  Handler,
  Teller,
  DepositManager,
  DepositManager__factory,
  WETH9__factory,
  SimpleERC20Token__factory,
  CanonicalAddressRegistry,
  CanonicalAddressRegistry__factory,
} from "@nocturne-xyz/contracts";

import {
  NocturneSigner,
  NocturneClient,
  InMemoryKVStore,
  NocturneDB,
  SparseMerkleProver,
  JoinSplitProver,
  SDKSyncAdapter,
  SubgraphSDKSyncAdapter,
  Address,
  sleep,
  thunk,
  Asset,
  AssetTrait,
  MockEthToTokenConverter,
  RPCSDKSyncAdapter,
  BundlerOpTracker,
  range,
} from "@nocturne-xyz/core";

import {
  NocturneDeployConfig,
  checkNocturneDeployment,
  deployNocturne,
} from "@nocturne-xyz/deploy";

import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
import { WasmJoinSplitProver } from "@nocturne-xyz/local-prover";
import { NocturneConfig } from "@nocturne-xyz/config";
import { startHardhat } from "./hardhat";
import { BundlerConfig, startBundler } from "./bundler";
import { DepositScreenerConfig, startDepositScreener } from "./screener";
import { startSubtreeUpdater, SubtreeUpdaterConfig } from "./subtreeUpdater";
import { startSubgraph, SubgraphConfig } from "./subgraph";
import { KEYS_TO_WALLETS } from "./keys";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import { BUNDLER_ENDPOINT } from "./utils";

// eslint-disable-next-line
const ROOT_DIR = findWorkspaceRoot()!;
const ARTIFACTS_DIR = path.join(ROOT_DIR, "circuit-artifacts");
const WASM_PATH = `${ARTIFACTS_DIR}/joinsplit/joinsplit_js/joinsplit.wasm`;
const ZKEY_PATH = `${ARTIFACTS_DIR}/joinsplit/joinsplit_cpp/joinsplit.zkey`;
const VKEY_PATH = `${ARTIFACTS_DIR}/joinsplit/joinsplit_cpp/vkey.json`;
const VKEY = JSON.parse(fs.readFileSync(VKEY_PATH).toString());

export interface TestDeployArgs {
  screeners: Address[];
  subtreeBatchFillers: Address[];
}

export interface TestActorsConfig {
  // specify which actors to include
  // if not given, all actors are deployed
  include: {
    bundler?: boolean;
    depositScreener?: boolean;
    subtreeUpdater?: boolean;
    subgraph?: boolean;
  };

  // specify configs for actors to deploy
  // if non-skipped actors don't have a config, one of the defaults below will be used
  configs?: {
    bundler?: Partial<BundlerConfig>;
    depositScreener?: Partial<DepositScreenerConfig>;
    subtreeUpdater?: Partial<SubtreeUpdaterConfig>;
    subgraph?: Partial<SubgraphConfig>;
  };
}

export interface TestDeploymentTokens {
  erc20: SimpleERC20Token;
  erc20Asset: Asset;
  gasToken: SimpleERC20Token;
  gasTokenAsset: Asset;
}

export interface TestContracts {
  teller: Teller;
  handler: Handler;
  depositManager: DepositManager;
  canonAddrRegistry: CanonicalAddressRegistry;
}

export interface TestDeployment {
  depositManager: DepositManager;
  teller: Teller;
  handler: Handler;
  canonAddrRegistry: CanonicalAddressRegistry;
  config: NocturneConfig;
  tokens: TestDeploymentTokens;
  provider: ethers.providers.JsonRpcProvider;
  deployerEoa: ethers.Wallet;
  aliceEoa: ethers.Wallet;
  bobEoa: ethers.Wallet;
  bundlerEoa: ethers.Wallet;
  subtreeUpdaterEoa: ethers.Wallet;
  screenerEoa: ethers.Wallet;
  actorConfig: TestActorsConfig;
  fillSubtreeBatch: () => Promise<void>;
  teardown: () => Promise<void>;
}

// defaults for actor deployments
const HH_URL = "http://0.0.0.0:8545";
export const SUBGRAPH_URL = "http://localhost:8000/subgraphs/name/nocturne";

const DEFAULT_BUNDLER_CONFIG: Pick<BundlerConfig, "maxLatency" | "rpcUrl"> = {
  maxLatency: 1,
  rpcUrl: HH_URL,
};

const DEFAULT_DEPOSIT_SCREENER_CONFIG: Omit<
  DepositScreenerConfig,
  "depositManagerAddress" | "txSignerKey" | "attestationSignerKey"
> = {
  rpcUrl: HH_URL,
  subgraphUrl: SUBGRAPH_URL,
};

const DEFAULT_SUBTREE_UPDATER_CONFIG: Omit<
  SubtreeUpdaterConfig,
  "handlerAddress" | "txSignerKey"
> = {
  rpcUrl: HH_URL,
  subgraphUrl: SUBGRAPH_URL,
  fillBatchLatency: undefined,
  // useRapidsnark: true,
};

const DEFAULT_SUBGRAPH_CONFIG: Omit<SubgraphConfig, "tellerAddress"> = {
  startBlock: 0,
};

// we want to only start anvil once, so we wrap `startAnvil` in a thunk
const hhThunk = thunk(() => startHardhat());

// returns an async function that should be called for teardown
// if include is not given, no off-chain actors will be deployed
export async function setupTestDeployment(
  config: TestActorsConfig
): Promise<TestDeployment> {
  // hardhat has to go up first,
  // then contracts,
  // then everything else can go up in any order

  const startTime = Date.now();

  // spin up anvil
  console.log("starting hardhat...");
  const resetHardhat = await hhThunk();

  // deploy contracts
  const provider = new ethers.providers.JsonRpcProvider(HH_URL);

  // keep track of any modified configs
  const actorConfig: TestActorsConfig = structuredClone(config);
  actorConfig.configs = actorConfig.configs ?? {};

  const [
    deployerEoa,
    aliceEoa,
    bobEoa,
    bundlerEoa,
    subtreeUpdaterEoa,
    screenerEoa,
  ] = KEYS_TO_WALLETS(provider);
  console.log("deploying contracts...");
  const [
    deployment,
    tokens,
    { teller, handler, depositManager, canonAddrRegistry },
  ] = await deployContractsWithDummyConfig(deployerEoa, {
    screeners: [screenerEoa.address],
    subtreeBatchFillers: [deployerEoa.address, subtreeUpdaterEoa.address],
  });

  console.log("erc20s:", deployment.erc20s);
  // Deploy subgraph first, as other services depend on it
  let stopSubgraph: undefined | (() => Promise<void>);
  if (config.include.subgraph) {
    const givenSubgraphConfig = config.configs?.subgraph ?? {};
    const subgraphConfig = {
      ...DEFAULT_SUBGRAPH_CONFIG,
      ...givenSubgraphConfig,
      tellerAddress: teller.address,
    };
    actorConfig.configs.subgraph = subgraphConfig;

    stopSubgraph = await startSubgraph(subgraphConfig);
    await sleep(15_000); // wait for subgraph to start up (TODO: better way to do this?)
  }

  // deploy everything else
  const proms = [];
  if (config.include.bundler) {
    const givenBundlerConfig = config.configs?.bundler ?? {};
    const bundlerConfig: BundlerConfig = {
      ...DEFAULT_BUNDLER_CONFIG,
      ...givenBundlerConfig,
      tellerAddress: teller.address,
      handlerAddress: handler.address,
      txSignerKey: bundlerEoa.privateKey,
    };
    actorConfig.configs.bundler = bundlerConfig;

    proms.push(startBundler(bundlerConfig));
  }

  // deploy subtree updater if requested
  if (config.include.subtreeUpdater) {
    const givenSubtreeUpdaterConfig = config.configs?.subtreeUpdater ?? {};
    const subtreeUpdaterConfig: SubtreeUpdaterConfig = {
      ...DEFAULT_SUBTREE_UPDATER_CONFIG,
      ...givenSubtreeUpdaterConfig,
      handlerAddress: handler.address,
      txSignerKey: subtreeUpdaterEoa.privateKey,
    };
    actorConfig.configs.subtreeUpdater = subtreeUpdaterConfig;

    proms.push(startSubtreeUpdater(subtreeUpdaterConfig));
  }

  if (config.include.depositScreener) {
    const givenDepositScreenerConfig = config.configs?.depositScreener ?? {};
    const depositScreenerConfig: DepositScreenerConfig = {
      ...DEFAULT_DEPOSIT_SCREENER_CONFIG,
      ...givenDepositScreenerConfig,
      depositManagerAddress: depositManager.address,
      attestationSignerKey: screenerEoa.privateKey,
      txSignerKey: screenerEoa.privateKey,
    };
    actorConfig.configs.depositScreener = depositScreenerConfig;

    proms.push(startDepositScreener(depositScreenerConfig, deployment.erc20s));
  }

  const actorTeardownFns = await Promise.all(proms);
  // wait for them all to start up
  await sleep(3_000);

  const teardown = async () => {
    console.log("tearing down offchain actors...");
    // teardown offchain actors
    await Promise.all(actorTeardownFns.map((fn) => fn()));

    // wait for actors to teardown
    await sleep(3_000);

    // teradown subgraph
    if (stopSubgraph) {
      console.log("tearing down subgraph...");
      await stopSubgraph();
      // wait for subgraph to tear down
      await sleep(15_000);
    }

    console.log("resetting hardhat...");
    // reset hardhat node
    await resetHardhat();

    // wait for hardhad to reset
    await sleep(1_000);
  };

  console.log(`setupTestDeployment took ${Date.now() - startTime}ms.`);

  const fillSubtreeBatch = async () => {
    const handler = Handler__factory.connect(
      deployment.handlerAddress(),
      subtreeUpdaterEoa
    );
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
    if (config.configs?.subtreeUpdater?.useRapidsnark) {
      await sleep(30_000);
    } else {
      await sleep(10_000);
    }
  };

  return {
    actorConfig,
    depositManager,
    teller,
    handler,
    canonAddrRegistry,
    tokens,
    config: deployment,
    provider,
    teardown,
    deployerEoa,
    aliceEoa,
    bobEoa,
    bundlerEoa,
    subtreeUpdaterEoa,
    screenerEoa,
    fillSubtreeBatch,
  };
}

export async function deployContractsWithDummyConfig(
  connectedSigner: ethers.Wallet,
  args: TestDeployArgs
): Promise<[NocturneConfig, TestDeploymentTokens, TestContracts]> {
  const weth = await new WETH9__factory(connectedSigner).deploy();
  console.log("weth address:", weth.address);

  const deployConfig: NocturneDeployConfig = {
    proxyAdminOwner: connectedSigner.address,
    screeners: args.screeners,
    subtreeBatchFillers: args.subtreeBatchFillers,
    wethAddress: weth.address,
    erc20s: new Map([
      [
        "erc20-1",
        {
          address: "0x0000000000000000000000000000000000000000",
          globalCapWholeTokens: 5000n,
          maxDepositSizeWholeTokens: 500n,
          precision: 18n,
          resetWindowHours: 3n,
          isGasAsset: true,
        },
      ],
      [
        "erc20-2",
        {
          address: "0x0000000000000000000000000000000000000000",
          globalCapWholeTokens: 5000n,
          maxDepositSizeWholeTokens: 500n,
          precision: 18n,
          resetWindowHours: 3n,
          isGasAsset: true,
        },
      ],
      [
        "weth",
        {
          address: weth.address,
          globalCapWholeTokens: 5000n,
          maxDepositSizeWholeTokens: 500n,
          precision: 18n,
          resetWindowHours: 3n,
          isGasAsset: true,
        },
      ],
    ]),
    protocolAllowlist: new Map(),
    leftoverTokenHolder: "0x0000000000000000000000000000000000000123",
    opts: {
      useMockSubtreeUpdateVerifier:
        process.env.ACTUALLY_PROVE_SUBTREE_UPDATE == undefined,
      confirmations: 1,
    },
  };

  console.log("deploying contracts...");
  const config = await deployNocturne(connectedSigner, deployConfig);
  checkNocturneDeployment(config, connectedSigner.provider);

  console.log("prefilling");
  await prefillErc20s(connectedSigner, config);

  // Log for dev site script
  const {
    depositManagerProxy,
    tellerProxy,
    handlerProxy,
    canonicalAddressRegistryProxy,
  } = config.contracts;
  console.log("Teller address:", tellerProxy.proxy);
  console.log("Handler address:", handlerProxy.proxy);
  console.log("DepositManager address:", depositManagerProxy.proxy);
  console.log(
    "CanonicalAddressRegistry address:",
    canonicalAddressRegistryProxy.proxy
  );

  // Also log for dev site script
  const erc20s = Array.from(config.erc20s);
  console.log(`ERC20 token 1 deployed at:`, erc20s[0][1].address);
  console.log(`ERC20 token 2 deployed at:`, erc20s[1][1].address);

  const [depositManager, teller, handler, canonAddrRegistry] =
    await Promise.all([
      DepositManager__factory.connect(
        depositManagerProxy.proxy,
        connectedSigner
      ),
      Teller__factory.connect(tellerProxy.proxy, connectedSigner),
      Handler__factory.connect(handlerProxy.proxy, connectedSigner),
      CanonicalAddressRegistry__factory.connect(
        canonicalAddressRegistryProxy.proxy,
        connectedSigner
      ),
    ]);

  return [
    config,
    formatTestTokens(
      connectedSigner,
      erc20s[0][1].address,
      erc20s[1][1].address
    ),
    { teller, handler, depositManager, canonAddrRegistry },
  ];
}

async function prefillErc20s(
  connectedSigner: ethers.Wallet,
  config: NocturneConfig
): Promise<void> {
  for (const [name, erc20] of config.erc20s.entries()) {
    if (name != "weth") {
      const token = SimpleERC20Token__factory.connect(
        erc20.address,
        connectedSigner
      );
      await token.reserveTokens(config.contracts.handlerProxy.proxy, 1);
    }
  }
}

function formatTestTokens(
  eoa: ethers.Wallet,
  erc20: Address,
  gasToken: Address
): TestDeploymentTokens {
  return {
    erc20: SimpleERC20Token__factory.connect(erc20, eoa),
    erc20Asset: AssetTrait.erc20AddressToAsset(erc20),
    gasToken: SimpleERC20Token__factory.connect(gasToken, eoa),
    gasTokenAsset: AssetTrait.erc20AddressToAsset(gasToken),
  };
}

export interface SetupNocturneOpts {
  syncAdapter?: SyncAdapterOption;
  gasAssets?: Map<string, string>;
}

export enum SyncAdapterOption {
  RPC,
  SUBGRAPH,
}

export interface ClientSetup {
  nocturneSignerAlice: NocturneSigner;
  nocturneDBAlice: NocturneDB;
  nocturneClientAlice: NocturneClient;
  nocturneSignerBob: NocturneSigner;
  nocturneDBBob: NocturneDB;
  nocturneClientBob: NocturneClient;
  joinSplitProver: JoinSplitProver;
}

export async function setupTestClient(
  config: NocturneConfig,
  provider: ethers.providers.Provider,
  opts?: SetupNocturneOpts
): Promise<ClientSetup> {
  const { handlerProxy } = config.contracts;

  let syncAdapter: SDKSyncAdapter;
  if (opts?.syncAdapter && opts.syncAdapter === SyncAdapterOption.SUBGRAPH) {
    syncAdapter = new SubgraphSDKSyncAdapter(SUBGRAPH_URL);
  } else {
    syncAdapter = new RPCSDKSyncAdapter(provider, handlerProxy.proxy);
  }

  console.log("Create nocturneClientAlice");
  const aliceKV = new InMemoryKVStore();
  const nocturneDBAlice = new NocturneDB(aliceKV);
  const merkleProverAlice = new SparseMerkleProver(aliceKV);
  const nocturneSignerAlice = new NocturneSigner(Uint8Array.from(range(32)));
  const nocturneClientAlice = setupNocturneClient(
    nocturneSignerAlice,
    config,
    provider,
    nocturneDBAlice,
    merkleProverAlice,
    syncAdapter
  );

  console.log("Create nocturneClientBob");
  const bobKV = new InMemoryKVStore();
  const nocturneDBBob = new NocturneDB(bobKV);
  const merkleProverBob = new SparseMerkleProver(aliceKV);
  const nocturneSignerBob = new NocturneSigner(
    Uint8Array.from(range(32).map((n) => 2 * n))
  );
  const nocturneClientBob = setupNocturneClient(
    nocturneSignerBob,
    config,
    provider,
    nocturneDBBob,
    merkleProverBob,
    syncAdapter
  );

  const joinSplitProver = new WasmJoinSplitProver(WASM_PATH, ZKEY_PATH, VKEY);

  return {
    nocturneDBAlice,
    nocturneSignerAlice,
    nocturneClientAlice,
    nocturneDBBob,
    nocturneSignerBob,
    nocturneClientBob,
    joinSplitProver,
  };
}

function setupNocturneClient(
  signer: NocturneSigner,
  config: NocturneConfig,
  provider: ethers.providers.Provider,
  nocturneDB: NocturneDB,
  merkleProver: SparseMerkleProver,
  syncAdapter: SDKSyncAdapter
): NocturneClient {
  return new NocturneClient(
    signer,
    provider,
    config,
    merkleProver,
    nocturneDB,
    syncAdapter,
    new MockEthToTokenConverter(),
    new BundlerOpTracker(BUNDLER_ENDPOINT)
  );
}
