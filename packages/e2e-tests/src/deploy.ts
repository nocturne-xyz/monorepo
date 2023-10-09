import { ethers } from "ethers";
import * as fs from "fs";
import {
  Teller__factory,
  Handler__factory,
  Handler,
  Teller,
  DepositManager,
  DepositManager__factory,
  SimpleERC20Token__factory,
  CanonicalAddressRegistry,
  CanonicalAddressRegistry__factory,
  WETH9,
  WETH9__factory,
} from "@nocturne-xyz/contracts";

import {
  NocturneSigner,
  InMemoryKVStore,
  SparseMerkleProver,
  JoinSplitProver,
  SDKSyncAdapter,
  Address,
  sleep,
  Asset,
  AssetTrait,
  range,
  CanonAddrSigCheckProver,
  thunk,
} from "@nocturne-xyz/core";

import {
  NocturneClient,
  NocturneDB,
  MockEthToTokenConverter,
  BundlerOpTracker,
} from "@nocturne-xyz/client";

import { RPCSDKSyncAdapter } from "@nocturne-xyz/rpc-sync-adapters";
import { SubgraphSDKSyncAdapter } from "@nocturne-xyz/subgraph-sync-adapters";

import {
  NocturneDeployConfig,
  checkNocturneDeployment,
  deployNocturne,
} from "@nocturne-xyz/deploy";

import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
import {
  WasmCanonAddrSigCheckProver,
  WasmJoinSplitProver,
} from "@nocturne-xyz/local-prover";
import {
  NocturneConfig,
  ProtocolAddressWithMethods,
} from "@nocturne-xyz/config";
import { ForkNetwork, startHardhat } from "./hardhat";
import { BundlerConfig, startBundler } from "./bundler";
import { DepositScreenerConfig, startDepositScreener } from "./screener";
import { startSubtreeUpdater, SubtreeUpdaterConfig } from "./subtreeUpdater";
import { InsertionWriterConfig, startInsertionWriter } from "./insertionWriter";
import { startSubgraph, SubgraphConfig } from "./subgraph";
import { KEYS_TO_WALLETS } from "./keys";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import { BUNDLER_ENDPOINT } from "./utils";

// eslint-disable-next-line
const ROOT_DIR = findWorkspaceRoot()!;
const ARTIFACTS_DIR = path.join(ROOT_DIR, "circuit-artifacts");

const JOINSPLIT_WASM_PATH = `${ARTIFACTS_DIR}/joinsplit/joinsplit_js/joinsplit.wasm`;
const JOINSPLIT_ZKEY_PATH = `${ARTIFACTS_DIR}/joinsplit/joinsplit_cpp/joinsplit.zkey`;
const JOINSPLIT_VKEY_PATH = `${ARTIFACTS_DIR}/joinsplit/joinsplit_cpp/vkey.json`;
const JOINSPLIT_VKEY = JSON.parse(
  fs.readFileSync(JOINSPLIT_VKEY_PATH).toString()
);

const SIG_CHECK_WASM_PATH = `${ARTIFACTS_DIR}/canonAddrSigCheck/canonAddrSigCheck_js/canonAddrSigCheck.wasm`;
const SIG_CHECK_ZKEY_PATH = `${ARTIFACTS_DIR}/canonAddrSigCheck/canonAddrSigCheck_cpp/canonAddrSigCheck.zkey`;
const SIG_CHECK_VKEY_PATH = `${ARTIFACTS_DIR}/canonAddrSigCheck/canonAddrSigCheck_cpp/vkey.json`;
const SIG_CHECK_VKEY = JSON.parse(
  fs.readFileSync(SIG_CHECK_VKEY_PATH).toString()
);

export interface TestDeployArgs {
  screeners: Address[];
  subtreeBatchFillers: Address[];
  protocolAllowlist: Map<string, ProtocolAddressWithMethods>;
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
  weth: WETH9;
}

export interface TestDeployment {
  depositManager: DepositManager;
  teller: Teller;
  handler: Handler;
  canonAddrRegistry: CanonicalAddressRegistry;
  config: NocturneConfig;
  weth: WETH9;
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

const DEFAULT_INSERTION_WRITER_CONFIG: InsertionWriterConfig = {
  subgraphUrl: SUBGRAPH_URL,
};

// we want to only start anvil once, so we wrap `startAnvil` in a thunk
const hhThunk = thunk((forkNetwork?: ForkNetwork) => startHardhat(forkNetwork));

// returns an async function that should be called for teardown
// if include is not given, no off-chain actors will be deployed
export async function setupTestDeployment(
  actorsConfig: TestActorsConfig,
  protocolAllowlist: Map<string, ProtocolAddressWithMethods> = new Map(),
  forkNetwork?: ForkNetwork
): Promise<TestDeployment> {
  // hardhat has to go up first,
  // then contracts,
  // then everything else can go up in any order

  const startTime = Date.now();

  // spin up anvil
  console.log("starting hardhat...");
  const resetHardhat = await hhThunk(forkNetwork);

  // deploy contracts
  const provider = new ethers.providers.JsonRpcProvider({
    url: HH_URL,
    timeout: 300_000,
  });

  // keep track of any modified configs
  const actorConfig: TestActorsConfig = structuredClone(actorsConfig);
  actorConfig.configs = actorConfig.configs ?? {};

  const [
    deployerEoa, // anvil account #0
    aliceEoa, // anvil account #1
    bobEoa, // anvil account #2
    bundlerEoa, // anvil account #3
    subtreeUpdaterEoa, // anvil account #4
    screenerEoa, // anvil account #5
  ] = KEYS_TO_WALLETS(provider);
  console.log("deploying contracts...");
  const [
    deployment,
    tokens,
    { teller, handler, depositManager, canonAddrRegistry, weth },
  ] = await deployContractsWithDummyConfig(deployerEoa, {
    screeners: [screenerEoa.address],
    subtreeBatchFillers: [deployerEoa.address, subtreeUpdaterEoa.address],
    protocolAllowlist: protocolAllowlist,
  });

  console.log("erc20s:", deployment.erc20s);
  // Deploy subgraph first, as other services depend on it
  let stopSubgraph: undefined | (() => Promise<void>);
  if (actorsConfig.include.subgraph) {
    const givenSubgraphConfig = actorsConfig.configs?.subgraph ?? {};
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
  if (actorsConfig.include.bundler) {
    const givenBundlerConfig = actorsConfig.configs?.bundler ?? {};
    const bundlerConfig: BundlerConfig = {
      ...DEFAULT_BUNDLER_CONFIG,
      ...givenBundlerConfig,
      bundlerAddress: bundlerEoa.address,
      tellerAddress: teller.address,
      handlerAddress: handler.address,
      txSignerKey: bundlerEoa.privateKey,
    };
    actorConfig.configs.bundler = bundlerConfig;

    proms.push(startBundler(bundlerConfig));
  }

  if (actorsConfig.include.depositScreener) {
    const givenDepositScreenerConfig =
      actorsConfig.configs?.depositScreener ?? {};
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

  // deploy subtree updater & insertion writer if requested
  if (actorsConfig.include.subtreeUpdater) {
    // subtree updater
    const givenSubtreeUpdaterConfig =
      actorsConfig.configs?.subtreeUpdater ?? {};
    const subtreeUpdaterConfig: SubtreeUpdaterConfig = {
      ...DEFAULT_SUBTREE_UPDATER_CONFIG,
      ...givenSubtreeUpdaterConfig,
      handlerAddress: handler.address,
      txSignerKey: subtreeUpdaterEoa.privateKey,
    };
    actorConfig.configs.subtreeUpdater = subtreeUpdaterConfig;

    const startUpdaterAndInsertionWriter = async () => {
      const teardownInsertionWriter = await startInsertionWriter(
        DEFAULT_INSERTION_WRITER_CONFIG
      );
      const teardownSubtreeUpdater = await startSubtreeUpdater(
        subtreeUpdaterConfig
      );

      return async () => {
        await teardownInsertionWriter();
        await teardownSubtreeUpdater();
      };
    };

    proms.push(startUpdaterAndInsertionWriter());
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
      deployment.handlerAddress,
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
    if (actorsConfig.configs?.subtreeUpdater?.useRapidsnark) {
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
    weth,
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
    finalityBlocks: 0,
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
    protocolAllowlist: args.protocolAllowlist,
    leftoverTokenHolder: "0x0000000000000000000000000000000000000123",
    opts: {
      useMockSubtreeUpdateVerifier:
        process.env.ACTUALLY_PROVE_SUBTREE_UPDATE == undefined,
      confirmations: 1,
    },
  };

  console.log("deploying contracts...");
  const { config } = await deployNocturne(connectedSigner, deployConfig);
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
    { teller, handler, depositManager, canonAddrRegistry, weth },
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
  canonAddrSigCheckProver: CanonAddrSigCheckProver;
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

  const joinSplitProver = new WasmJoinSplitProver(
    JOINSPLIT_WASM_PATH,
    JOINSPLIT_ZKEY_PATH,
    JOINSPLIT_VKEY
  );

  const canonAddrSigCheckProver = new WasmCanonAddrSigCheckProver(
    SIG_CHECK_WASM_PATH,
    SIG_CHECK_ZKEY_PATH,
    SIG_CHECK_VKEY
  );

  return {
    nocturneDBAlice,
    nocturneSignerAlice,
    nocturneClientAlice,
    nocturneDBBob,
    nocturneSignerBob,
    nocturneClientBob,
    joinSplitProver,
    canonAddrSigCheckProver,
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
