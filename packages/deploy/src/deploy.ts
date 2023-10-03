import {
  JoinSplitVerifier__factory,
  ProxyAdmin,
  ProxyAdmin__factory,
  SubtreeUpdateVerifier,
  SubtreeUpdateVerifier__factory,
  TestSubtreeUpdateVerifier,
  TestSubtreeUpdateVerifier__factory,
  TransparentUpgradeableProxy__factory,
  CanonicalAddressRegistry__factory,
  Handler__factory,
  Teller__factory,
  DepositManager__factory,
  SimpleERC20Token__factory,
  DepositManager,
  Handler,
  CanonAddrSigCheckVerifier__factory,
  WstethAdapter__factory,
  EthTransferAdapter__factory,
  WstethAdapter,
  EthTransferAdapter,
  RethAdapter,
  RethAdapter__factory,
  IPoseidonExtT7__factory,
} from "@nocturne-xyz/contracts";
import { ethers } from "ethers";
import { ProxiedContract } from "./proxy";
import {
  ProxyKind,
  TransparentProxyAddresses,
  NocturneContractDeployment,
  Erc20Config,
  ProtocolAddressWithMethods,
} from "@nocturne-xyz/config";
import { NocturneDeployConfig, NocturneDeployOpts } from "./config";
import { NocturneConfig } from "@nocturne-xyz/config";
import { Address, getSelector } from "./utils";
import { protocolWhitelistKey } from "@nocturne-xyz/core";
import * as fs from "fs";
import findWorkspaceRoot from "find-yarn-workspace-root";
import {
  NocturneDeploymentVerification,
  NocturneDeploymentVerificationData,
  NocturneProxyContractName,
  ProxyContractVerification,
} from "./verification";

const ROOT_DIR = findWorkspaceRoot()!;
const POSEIDON_EXT_T7_BYTECODE = fs.readFileSync(
  `${ROOT_DIR}/packages/contracts/poseidon-bytecode/PoseidonExtT7.txt`,
  "utf-8"
);

export interface NocturneContractDeploymentAndVerification {
  contracts: NocturneContractDeployment;
  verification: NocturneDeploymentVerificationData;
}

export interface NocturneConfigAndVerification {
  config: NocturneConfig;
  verification: NocturneDeploymentVerification;
}

export async function deployNocturne(
  connectedSigner: ethers.Wallet,
  config: NocturneDeployConfig
): Promise<NocturneConfigAndVerification> {
  if (!connectedSigner.provider)
    throw new Error("ethers.Wallet must be connected to provider");

  // Maybe deploy erc20s
  const erc20s = await maybeDeployErc20s(connectedSigner, config.erc20s);
  config.erc20s = erc20s;

  // Deploy eth transfer adapter
  const ethTransferAdapter = await deployEthTransferAdapter(
    connectedSigner,
    config.wethAddress,
    config.opts
  );

  // Maybe deploy wsteth/reth adapters, depending on deploy config
  const maybeWstethAdapter = await maybeDeployWstethAdapter(
    connectedSigner,
    config.wethAddress,
    config.opts
  );
  const maybeRethAdapter = await maybeDeployRethAdapter(
    connectedSigner,
    config.wethAddress,
    config.opts
  );

  // Deploy core contracts
  const { contracts, verification } = await deployNocturneCoreContracts(
    connectedSigner,
    config
  );

  // Set erc20 caps
  const depositManager = DepositManager__factory.connect(
    contracts.depositManagerProxy.proxy,
    connectedSigner
  );
  await setErc20Caps(depositManager, config);

  // Whitelist erc20s
  const handler = Handler__factory.connect(
    contracts.handlerProxy.proxy,
    connectedSigner
  );

  const tokens = Array.from(config.erc20s.values()).map(
    (erc20) => erc20.address
  );

  for (const [name, erc20Config] of Array.from(config.erc20s)) {
    const addressWithSignatures: ProtocolAddressWithMethods = {
      address: erc20Config.address,
      functionSignatures: [
        "approve(address,uint256)",
        "transfer(address,uint256)",
      ],
    };
    config.protocolAllowlist.set(name, addressWithSignatures);
  }

  // Whitelist eth transfer adapter
  config.protocolAllowlist.set("ethTransferAdapter", {
    address: ethTransferAdapter.address,
    functionSignatures: ["transfer(address,uint256)"],
  });

  // Whitelist wsteth/reth adapters if exists
  if (maybeWstethAdapter) {
    const addressWithSignature: ProtocolAddressWithMethods = {
      address: maybeWstethAdapter.address,
      functionSignatures: ["deposit(uint256)"],
    };
    config.protocolAllowlist.set("wstethAdapter", addressWithSignature);
  }
  if (maybeRethAdapter) {
    const addressWithSignature: ProtocolAddressWithMethods = {
      address: maybeRethAdapter.address,
      functionSignatures: ["deposit(uint256)"],
    };
    config.protocolAllowlist.set("rethAdapter", addressWithSignature);
  }

  await whitelistTokens(connectedSigner, tokens, handler);

  await whitelistProtocols(connectedSigner, config.protocolAllowlist, handler);

  await relinquishContractOwnership(connectedSigner, config, contracts);

  return {
    config: NocturneConfig.fromObject({
      contracts,
      erc20s: Array.from(erc20s.entries()),
      protocolAllowlist: Array.from(config.protocolAllowlist.entries()),
    }),
    verification: new NocturneDeploymentVerification(verification),
  };
}

export async function deployNocturneCoreContracts(
  connectedSigner: ethers.Wallet,
  config: NocturneDeployConfig
): Promise<NocturneContractDeploymentAndVerification> {
  console.log("\ngetting network...");
  const { name, chainId } = await connectedSigner.provider.getNetwork();
  console.log("\nfetching current block number...");
  const startBlock = await connectedSigner.provider.getBlockNumber();

  // Maybe deploy proxy admin
  const { opts, leftoverTokenHolder } = config;
  let proxyAdmin = opts?.proxyAdmin;
  if (!proxyAdmin) {
    console.log("\ndeploying ProxyAdmin...");
    proxyAdmin = await new ProxyAdmin__factory(connectedSigner).deploy();
    const tx = await proxyAdmin.transferOwnership(config.proxyAdminOwner);
    await tx.wait(opts?.confirmations);
  }

  console.log("\ndeploying JoinSplitVerifier...");
  const joinSplitVerifier = await new JoinSplitVerifier__factory(
    connectedSigner
  ).deploy();
  await joinSplitVerifier.deployTransaction.wait(opts?.confirmations);

  let subtreeUpdateVerifier: SubtreeUpdateVerifier | TestSubtreeUpdateVerifier;
  console.log("\ndeploying SubtreeUpdateVerifier...");
  if (opts?.useMockSubtreeUpdateVerifier) {
    subtreeUpdateVerifier = await new TestSubtreeUpdateVerifier__factory(
      connectedSigner
    ).deploy();
  } else {
    subtreeUpdateVerifier = await new SubtreeUpdateVerifier__factory(
      connectedSigner
    ).deploy();
  }
  await subtreeUpdateVerifier.deployTransaction.wait(opts?.confirmations);

  // Start map of proxy verification objects
  const proxies: {
    [T in NocturneProxyContractName]: ProxyContractVerification<T>;
  } = {} as any;

  // Deploy handler proxy
  console.log("\ndeploying proxied Handler...");
  const proxiedHandler = await deployProxiedContract(
    new Handler__factory(connectedSigner),
    proxyAdmin,
    [subtreeUpdateVerifier.address, leftoverTokenHolder]
  );
  proxies["Handler"] = {
    contractName: "Handler",
    address: proxiedHandler.proxyAddresses.proxy,
    implementationAddress: proxiedHandler.proxyAddresses.implementation,
    constructorArgs: proxiedHandler.constructorArgs,
  };
  console.log("deployed proxied Handler:", proxiedHandler.proxyAddresses);

  // Deploy poseidonExtT7 contract
  console.log("\ndeploying poseidonExtT7...");
  const poseidonExtT7 = await new ethers.ContractFactory(
    IPoseidonExtT7__factory.createInterface(),
    POSEIDON_EXT_T7_BYTECODE,
    connectedSigner
  ).deploy();
  await poseidonExtT7.deployTransaction.wait(opts?.confirmations);

  console.log("\ndeploying proxied Teller...");
  const tellerInitArgs: [string, string, string, string, string] = [
    "NocturneTeller",
    "v1",
    proxiedHandler.address,
    joinSplitVerifier.address,
    poseidonExtT7.address,
  ];
  const proxiedTeller = await deployProxiedContract(
    new Teller__factory(connectedSigner),
    proxyAdmin,
    tellerInitArgs // initialize here
  );
  proxies["Teller"] = {
    contractName: "Teller",
    address: proxiedTeller.proxyAddresses.proxy,
    implementationAddress: proxiedTeller.proxyAddresses.implementation,
    constructorArgs: proxiedTeller.constructorArgs,
  };
  console.log("deployed proxied Teller:", proxiedTeller.proxyAddresses);

  console.log("\nSetting Teller address in Handler...");
  const setTellerTx = await proxiedHandler.contract.setTeller(
    proxiedTeller.address
  );
  await setTellerTx.wait(opts?.confirmations);

  console.log("\ndeploying proxied DepositManager...");
  const proxiedDepositManager = await deployProxiedContract(
    new DepositManager__factory(connectedSigner),
    proxyAdmin,
    ["NocturneDepositManager", "v1", proxiedTeller.address, config.wethAddress] // initialize here
  );
  proxies["DepositManager"] = {
    contractName: "DepositManager",
    address: proxiedDepositManager.proxyAddresses.proxy,
    implementationAddress: proxiedDepositManager.proxyAddresses.implementation,
    constructorArgs: proxiedDepositManager.constructorArgs,
  };
  console.log(
    "deployed proxied DepositManager:",
    proxiedDepositManager.proxyAddresses
  );

  console.log("\ndeploying sig check verifier...");
  const canonAddrSigCheckVerifier =
    await new CanonAddrSigCheckVerifier__factory(connectedSigner).deploy();
  await canonAddrSigCheckVerifier.deployTransaction.wait(opts?.confirmations);

  console.log("\ndeploying canonical address registry...");
  const proxiedCanonAddrRegistry = await deployProxiedContract(
    new CanonicalAddressRegistry__factory(connectedSigner),
    proxyAdmin,
    [
      "NocturneCanonicalAddressRegistry",
      "v1",
      canonAddrSigCheckVerifier.address,
    ]
  );
  proxies["CanonicalAddressRegistry"] = {
    contractName: "CanonicalAddressRegistry",
    address: proxiedCanonAddrRegistry.proxyAddresses.proxy,
    implementationAddress:
      proxiedCanonAddrRegistry.proxyAddresses.implementation,
    constructorArgs: proxiedCanonAddrRegistry.constructorArgs,
  };
  console.log(
    "deployed proxied CanonicalAddressRegistry:",
    proxiedCanonAddrRegistry.proxyAddresses
  );

  console.log("\nsetting deposit manager screeners...");
  for (const screener of config.screeners) {
    const tx = await proxiedDepositManager.contract.setScreenerPermission(
      screener,
      true
    );
    await tx.wait(opts?.confirmations);
  }

  console.log("\nsetting teller bundlers...");
  for (const bundler of config.bundlers) {
    const tx = await proxiedTeller.contract.setBundlerPermission(bundler, true);
    await tx.wait(opts?.confirmations);
  }

  console.log("\nsetting subtree batch fillers...");
  for (const filler of config.subtreeBatchFillers) {
    const tx = await proxiedHandler.contract.setSubtreeBatchFillerPermission(
      filler,
      true
    );
    await tx.wait(opts?.confirmations);
  }

  console.log("\nadding deposit manager to teller deposit sources...");
  const enrollDepositManagerTx =
    await proxiedTeller.contract.setDepositSourcePermission(
      proxiedDepositManager.address,
      true
    );
  await enrollDepositManagerTx.wait(opts?.confirmations);

  return {
    contracts: {
      network: {
        name,
        chainId,
      },
      startBlock,
      owners: {
        proxyAdminOwner: config.proxyAdminOwner,
        // Below owners are all anticipated, ownership relinquished after this fn
        // NOTE: if contracts owners don't match proxyAdminOwner, check fn will throw error
        tellerOwner: config.proxyAdminOwner,
        handlerOwner: config.proxyAdminOwner,
        depositManagerOwner: config.proxyAdminOwner,
      },
      proxyAdmin: proxyAdmin.address,
      finalityBlocks: config.finalityBlocks,
      canonicalAddressRegistryProxy: proxiedCanonAddrRegistry.proxyAddresses,
      depositManagerProxy: proxiedDepositManager.proxyAddresses,
      tellerProxy: proxiedTeller.proxyAddresses,
      handlerProxy: proxiedHandler.proxyAddresses,
      poseidonExtT7Address: poseidonExtT7.address,
      joinSplitVerifierAddress: joinSplitVerifier.address,
      subtreeUpdateVerifierAddress: subtreeUpdateVerifier.address,
      canonAddrSigCheckVerifierAddress: canonAddrSigCheckVerifier.address,
      screeners: config.screeners,
      depositSources: [proxiedDepositManager.address],
    },
    verification: {
      chain: name,
      chainId,
      numOptimizations: 500, // TODO: make parametrizable?
      proxies,
    },
  };
}

async function deployEthTransferAdapter(
  connectedSigner: ethers.Wallet,
  wethAddress: Address,
  opts?: NocturneDeployOpts
): Promise<EthTransferAdapter> {
  console.log("\ndeploying EthTransferAdapter...");
  const ethTransferAdapter = await new EthTransferAdapter__factory(
    connectedSigner
  ).deploy(wethAddress);
  await ethTransferAdapter.deployTransaction.wait(opts?.confirmations);

  return ethTransferAdapter;
}

async function maybeDeployWstethAdapter(
  connectedSigner: ethers.Wallet,
  wethAddress: Address,
  opts?: NocturneDeployOpts
): Promise<WstethAdapter | undefined> {
  if (!opts?.wstethAdapterDeployConfig) {
    return undefined;
  }

  const { wstethAddress } = opts.wstethAdapterDeployConfig;

  console.log("\ndeploying WstethAdapter...");
  const wstethAdapter = await new WstethAdapter__factory(
    connectedSigner
  ).deploy(wethAddress, wstethAddress);
  await wstethAdapter.deployTransaction.wait(opts?.confirmations);

  return wstethAdapter;
}

async function maybeDeployRethAdapter(
  connectedSigner: ethers.Wallet,
  wethAddress: Address,
  opts?: NocturneDeployOpts
): Promise<RethAdapter | undefined> {
  if (!opts?.rethAdapterDeployConfig) {
    return undefined;
  }

  const { rocketPoolStorageAddress } = opts.rethAdapterDeployConfig;

  console.log("\ndeploying RethAdapter...");
  const rethAdapter = await new RethAdapter__factory(connectedSigner).deploy(
    wethAddress,
    rocketPoolStorageAddress
  );
  await rethAdapter.deployTransaction.wait(opts?.confirmations);

  return rethAdapter;
}

async function maybeDeployErc20s(
  connectedSigner: ethers.Wallet,
  erc20s: Map<string, Erc20Config>
): Promise<Map<string, Erc20Config>> {
  const ret = new Map(Array.from(erc20s.entries()));
  const iSimpleErc20 = new SimpleERC20Token__factory(connectedSigner);

  for (const [name, config] of Array.from(ret)) {
    if (!ethers.utils.isAddress(config.address)) {
      throw new Error(
        `invalid address for ${name}. address: ${config.address}`
      );
    }

    if (config.address == "0x0000000000000000000000000000000000000000") {
      console.log(`deploying erc20 ${name}...`);
      const token = await iSimpleErc20.deploy();
      config.address = token.address;
      ret.set(name, config);
    }
  }

  return ret;
}

async function setErc20Caps(
  depositManager: DepositManager,
  config: NocturneDeployConfig
): Promise<void> {
  console.log("\nsetting deposit manager erc20 caps...");
  for (const [name, erc20Config] of Array.from(config.erc20s)) {
    console.log(`setting erc20 cap for ${name}...`);
    const tx = await depositManager.setErc20Cap(
      erc20Config.address,
      erc20Config.globalCapWholeTokens,
      erc20Config.maxDepositSizeWholeTokens,
      erc20Config.resetWindowHours,
      erc20Config.precision
    );
    await tx.wait(config.opts?.confirmations);
  }
}

export async function whitelistTokens(
  connectedSigner: ethers.Wallet,
  tokens: string[],
  handler: Handler
): Promise<void> {
  handler = handler.connect(connectedSigner);

  console.log("whitelisting tokens...");
  for (const token of tokens) {
    if (!(await handler._supportedContracts(token))) {
      console.log(`whitelisting token: ${token}`);
      const tx = await handler.setContractPermission(token, true);
      await tx.wait(1);
    }
  }
}

export async function whitelistProtocols(
  connectedSigner: ethers.Wallet,
  protocolWhitelist: Map<string, ProtocolAddressWithMethods>,
  handler: Handler
): Promise<void> {
  handler = handler.connect(connectedSigner);

  console.log("whitelisting protocols...");
  for (const [name, addressWithMethods] of Array.from(protocolWhitelist)) {
    const contractAddress = addressWithMethods.address;

    console.log(`whitelisting protocol: ${name}. address: ${contractAddress}`);
    const tx = await handler.setContractPermission(contractAddress, true);
    await tx.wait(1);

    for (const signature of addressWithMethods.functionSignatures) {
      const selector = getSelector(signature);
      const key = protocolWhitelistKey(contractAddress, selector);

      if (!(await handler._supportedContractMethods(key))) {
        console.log(
          `whitelisting protocol: ${name}. address: ${contractAddress}. method: ${signature}`
        );
        const tx = await handler.setContractMethodPermission(
          contractAddress,
          selector,
          true
        );
        await tx.wait(1);
      }
    }
  }
}

export async function relinquishContractOwnership(
  connectedSigner: ethers.Wallet,
  config: NocturneDeployConfig,
  deployment: NocturneContractDeployment
): Promise<void> {
  const { opts } = config;

  const teller = Teller__factory.connect(
    deployment.tellerProxy.proxy,
    connectedSigner
  );
  const handler = Handler__factory.connect(
    deployment.handlerProxy.proxy,
    connectedSigner
  );
  const depositManager = DepositManager__factory.connect(
    deployment.depositManagerProxy.proxy,
    connectedSigner
  );

  console.log(
    `\nrelinquishing control of teller. new owner: ${config.proxyAdminOwner}.`
  );
  const tellerTransferOwnershipTx = await teller.transferOwnership(
    config.proxyAdminOwner
  );
  await tellerTransferOwnershipTx.wait(opts?.confirmations);

  console.log(
    `relinquishing control of handler. new owner: ${config.proxyAdminOwner}.`
  );
  const handlerTransferOwnershipTx = await handler.transferOwnership(
    config.proxyAdminOwner
  );
  await handlerTransferOwnershipTx.wait(opts?.confirmations);

  console.log(
    `relinquishing control of deposit manager. new owner: ${config.proxyAdminOwner}.`
  );
  const depositManagerTransferOwnershipTx =
    await depositManager.transferOwnership(config.proxyAdminOwner);
  await depositManagerTransferOwnershipTx.wait(opts?.confirmations);
}

async function deployProxiedContract<
  F extends ethers.ContractFactory,
  C extends Awaited<ReturnType<F["deploy"]>>
>(
  implementationFactory: F,
  proxyAdmin: ProxyAdmin,
  initArgs?: Parameters<C["initialize"]>,
  opts?: NocturneDeployOpts
): Promise<ProxiedContract<C, TransparentProxyAddresses>> {
  const implementation = await implementationFactory.deploy();
  await implementation.deployTransaction.wait(opts?.confirmations);

  // If no init args provided, then set init data to empty
  let initData = "0x";
  if (initArgs) {
    initData = implementation.interface.encodeFunctionData(
      "initialize",
      initArgs
    );
  }

  const proxyConstructorArgs: Parameters<
    TransparentUpgradeableProxy__factory["deploy"]
  > = [implementation.address, proxyAdmin.address, initData];
  const proxy = await new TransparentUpgradeableProxy__factory(
    implementationFactory.signer
  ).deploy(...proxyConstructorArgs);
  await proxy.deployTransaction.wait(opts?.confirmations);

  return new ProxiedContract<C, TransparentProxyAddresses>(
    implementation.attach(proxy.address) as C,
    {
      kind: ProxyKind.Transparent,
      proxy: proxy.address,
      implementation: implementation.address,
    },
    proxyConstructorArgs as string[]
  );
}
