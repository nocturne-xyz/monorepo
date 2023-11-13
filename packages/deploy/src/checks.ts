import { ethers } from "ethers";
import {
  CanonicalAddressRegistry,
  CanonicalAddressRegistry__factory,
  DepositManager,
  DepositManager__factory,
  EthTransferAdapter__factory,
  Handler,
  Handler__factory,
  ProxyAdmin__factory,
  RethAdapter__factory,
  Teller,
  Teller__factory,
  UniswapV3Adapter__factory,
  WstethAdapter__factory,
} from "@nocturne-xyz/contracts";
import {
  NocturneContractDeployment,
  Erc20Config,
  ProtocolAddressWithMethods,
  NocturneConfig,
} from "@nocturne-xyz/config";
import { proxyAdmin, proxyImplementation } from "./proxyUtils";
import { assertOrErr, getSelector, protocolWhitelistKey } from "./utils";
import { NocturneDeployConfig } from "./config";

export interface NocturneDeploymentCheckOpts {
  // 2-step ownable requires check to happen after deploy and ownership acceptance
  skipOwnersCheck: boolean;
}

export async function checkNocturneDeployment(
  deployConfig: NocturneDeployConfig,
  config: NocturneConfig,
  provider: ethers.providers.Provider,
  opts?: NocturneDeploymentCheckOpts
): Promise<void> {
  await checkNocturneCoreContracts(config, provider, opts);
  await checkNocturneAdapterStateVars(deployConfig, config, provider);
}

async function checkNocturneCoreContracts(
  config: NocturneConfig,
  provider: ethers.providers.Provider,
  opts?: NocturneDeploymentCheckOpts
): Promise<void> {
  await checkCoreStateVars(config, provider, opts);
  await checkProxyInfo(config.contracts, provider);
}

async function checkProxyInfo(
  deployment: NocturneContractDeployment,
  provider: ethers.providers.Provider
): Promise<void> {
  console.log("checking config proxy admin owner matches config");
  const proxyAdminContract = ProxyAdmin__factory.connect(
    deployment.proxyAdmin,
    provider
  );
  const proxyAdminOwnerActual = await proxyAdminContract.owner();
  assertOrErr(
    proxyAdminOwnerActual === deployment.owners.proxyAdminOwner,
    "proxy admin owner inconsistent"
  );

  console.log("checking teller proxy admin matches config");
  const tellerProxyAdmin = await proxyAdmin(
    provider,
    deployment.tellerProxy.proxy
  );
  assertOrErr(
    tellerProxyAdmin === deployment.proxyAdmin,
    "teller proxy admin incorrectly set"
  );

  console.log("checking handler proxy admin matches config");
  const handlerProxyAdmin = await proxyAdmin(
    provider,
    deployment.handlerProxy.proxy
  );
  assertOrErr(
    handlerProxyAdmin === deployment.proxyAdmin,
    "handler proxy admin incorrectly set"
  );

  console.log("checking deposit manager proxy admin matches config");
  const depositManagerProxyAdmin = await proxyAdmin(
    provider,
    deployment.depositManagerProxy.proxy
  );
  assertOrErr(
    depositManagerProxyAdmin === deployment.proxyAdmin,
    "deposit manager proxy admin incorrectly set"
  );

  console.log("checking canonical address registry proxy admin matches config");
  const canonicalAddressRegistryProxyAdmin = await proxyAdmin(
    provider,
    deployment.canonicalAddressRegistryProxy.proxy
  );
  assertOrErr(
    canonicalAddressRegistryProxyAdmin === deployment.proxyAdmin,
    "canonical address registry proxy admin incorrectly set"
  );

  console.log("checking teller proxy implementation matches config");
  const tellerProxyImplementation = await proxyImplementation(
    provider,
    deployment.tellerProxy.proxy
  );
  assertOrErr(
    tellerProxyImplementation === deployment.tellerProxy.implementation,
    "teller proxy implementation does not match deployment"
  );

  console.log("checking handler proxy implementation matches config");
  const handlerProxyImplementation = await proxyImplementation(
    provider,
    deployment.handlerProxy.proxy
  );
  assertOrErr(
    handlerProxyImplementation === deployment.handlerProxy.implementation,
    "handler proxy implementation does not match deployment"
  );

  console.log("checking deposit manager proxy implementation matches config");
  const depositManagerProxyImplementation = await proxyImplementation(
    provider,
    deployment.depositManagerProxy.proxy
  );
  assertOrErr(
    depositManagerProxyImplementation ===
      deployment.depositManagerProxy.implementation,
    "deposit manager proxy implementation does not match deployment"
  );

  console.log(
    "checking canonical address registry proxy implementation matches config"
  );
  const canonicalAddressRegistryProxyImplementation = await proxyImplementation(
    provider,
    deployment.canonicalAddressRegistryProxy.proxy
  );
  assertOrErr(
    canonicalAddressRegistryProxyImplementation ===
      deployment.canonicalAddressRegistryProxy.implementation,
    "canonical address registry proxy implementation does not match deployment"
  );
}

async function checkCoreStateVars(
  config: NocturneConfig,
  provider: ethers.providers.Provider,
  opts?: NocturneDeploymentCheckOpts
): Promise<void> {
  await checkTellerStateVars(config, provider, opts);
  await checkHandlerStateVars(config, provider, opts);
  await checkDepositManagerStateVars(config, provider, opts);
  await checkCanonicalAddressRegistryStateVars(config, provider, opts);
}

async function checkTellerStateVars(
  config: NocturneConfig,
  provider: ethers.providers.Provider,
  opts?: NocturneDeploymentCheckOpts
): Promise<void> {
  const deployment = config.contracts;
  const tellerContract = Teller__factory.connect(
    deployment.tellerProxy.proxy,
    provider
  );

  if (!opts?.skipOwnersCheck) {
    console.log("checking teller owner matches config");
    const expectedOwner = deployment.owners.contractOwner;
    const tellerOwner = await tellerContract.owner();
    assertOrErr(
      tellerOwner === expectedOwner,
      `teller owner does not match config: ${tellerOwner} != ${expectedOwner}`
    );
  }

  console.log("checking teller handler matches config");
  const tellerHandler = await tellerContract._handler();
  assertOrErr(
    tellerHandler === deployment.handlerProxy.proxy,
    "teller handler does not match deployment"
  );

  console.log("checking teller joinsplit verifier matches config");
  const tellerJoinSplitVerifier = await tellerContract._joinSplitVerifier();
  assertOrErr(
    tellerJoinSplitVerifier === deployment.joinSplitVerifierAddress,
    "teller joinsplit verifier does not match deployment"
  );

  console.log("checking teller deposit manager is whitelisted");
  const hasDepositManager = await tellerContract._depositSources(
    deployment.depositManagerProxy.proxy
  );
  assertOrErr(
    hasDepositManager,
    "teller did not whitelist deposit manager as deposit source"
  );

  console.log("checking teller poseidonExtT7 address matches config");
  const poseidonExtT7 = await tellerContract._poseidonExtT7();
  assertOrErr(
    poseidonExtT7 === deployment.poseidonExtT7Address,
    "teller poseidonExtT7 does not match deployment"
  );

  console.log("checking teller is not paused");
  const isPaused = await tellerContract.paused();
  assertOrErr(!isPaused, "teller is paused");

  console.log("checking Teller EIP 712 info matches expected");
  await checkEip712("Teller", tellerContract);
}

async function checkHandlerStateVars(
  config: NocturneConfig,
  provider: ethers.providers.Provider,
  opts?: NocturneDeploymentCheckOpts
): Promise<void> {
  const deployment = config.contracts;
  const handlerContract = Handler__factory.connect(
    deployment.handlerProxy.proxy,
    provider
  );

  if (!opts?.skipOwnersCheck) {
    console.log("checking handler owner matches config");
    const expectedOwner = deployment.owners.contractOwner;
    const handlerOwner = await handlerContract.owner();
    assertOrErr(
      handlerOwner === expectedOwner,
      `handler owner does not match config: ${handlerOwner} != ${expectedOwner}`
    );
  }

  console.log("checking handler teller matches config");
  const handlerTeller = await handlerContract._teller();
  assertOrErr(
    handlerTeller === deployment.tellerProxy.proxy,
    "handler teller does not match deployment"
  );

  console.log("checking handler leftover tokens holder matches config");
  const leftoverTokensHolder = await handlerContract._leftoverTokensHolder();
  assertOrErr(
    leftoverTokensHolder === deployment.leftoverTokensHolder,
    "handler leftover tokens holder does not match deployment"
  );

  // TODO: is there a way to check subtree update verifier embedded in merkle struct?

  console.log("checking handler subtree batch fillers match config");
  for (const subtreeBatchFiller of config.offchain.subtreeBatchFillers) {
    const isSubtreeBatchFiller = await handlerContract._subtreeBatchFillers(
      subtreeBatchFiller
    );
    assertOrErr(
      isSubtreeBatchFiller,
      `handler did not whitelist subtree batch filler ${subtreeBatchFiller}`
    );
  }

  console.log("checking handler is not paused");
  const isPaused = await handlerContract.paused();
  assertOrErr(!isPaused, "handler is paused");

  console.log("checking handler reentrancy guard stage is 1");
  const reentrancyGuardStage = (
    await handlerContract.reentrancyGuardStage()
  ).toNumber();
  assertOrErr(
    reentrancyGuardStage === 1,
    "handler reentrancy guard stage is not 1 (NOT_ENTERED)"
  );

  console.log("checking handler protocol allowlist is whitelisted...");
  await checkProtocolAllowlist(
    handlerContract,
    config.erc20s,
    config.protocolAllowlist
  );
}

async function checkDepositManagerStateVars(
  config: NocturneConfig,
  provider: ethers.providers.Provider,
  opts?: NocturneDeploymentCheckOpts
): Promise<void> {
  const deployment = config.contracts;
  const depositManagerContract = DepositManager__factory.connect(
    deployment.depositManagerProxy.proxy,
    provider
  );

  if (!opts?.skipOwnersCheck) {
    console.log("checking deposit manager owner matches config");
    const expectedOwner = deployment.owners.contractOwner;
    const depositManagerOwner = await depositManagerContract.owner();
    assertOrErr(
      depositManagerOwner === expectedOwner,
      `deposit manager owner does not match config: ${depositManagerOwner} != ${expectedOwner}`
    );
  }

  console.log("checking deposit manager weth matches config");
  const depositManagerWeth = await depositManagerContract._weth();
  assertOrErr(
    depositManagerWeth === config.erc20s.get("WETH")!.address,
    "deposit manager weth does not match deployment"
  );

  console.log("checking deposit manager teller matches config");
  const depositManagerTeller = await depositManagerContract._teller();
  assertOrErr(
    depositManagerTeller === deployment.tellerProxy.proxy,
    "deposit manager teller does not match deployment"
  );

  for (const screener of config.offchain.screeners) {
    console.log(`checking deposit manager screener ${screener} is whitelisted`);
    const hasScreener = await depositManagerContract._screeners(screener);
    assertOrErr(
      hasScreener,
      `depositManager did not whitelist screener ${screener}`
    );
  }

  console.log("checking deposit manager erc20 caps set...");
  await checkErc20Caps(depositManagerContract, config.erc20s);

  console.log("checking deposit manager EIP 712 info matches expected");
  await checkEip712("DepositManager", depositManagerContract);
}

async function checkCanonicalAddressRegistryStateVars(
  config: NocturneConfig,
  provider: ethers.providers.Provider,
  _opts?: NocturneDeploymentCheckOpts
): Promise<void> {
  const deployment = config.contracts;
  const canonicalAddressRegistryContract =
    CanonicalAddressRegistry__factory.connect(
      deployment.canonicalAddressRegistryProxy.proxy,
      provider
    );

  console.log(
    "checking canonical address registry sig check verifier matches config"
  );
  const sigCheckVerifier =
    await canonicalAddressRegistryContract._sigCheckVerifier();
  assertOrErr(
    sigCheckVerifier === deployment.canonAddrSigCheckVerifierAddress,
    "canonical address registry sig check verifier does not match deployment"
  );

  console.log(
    "checking canonical address registry EIP 712 info matches expected"
  );
  await checkEip712(
    "CanonicalAddressRegistry",
    canonicalAddressRegistryContract
  );
}

async function checkEip712(
  contractName: "Teller" | "DepositManager" | "CanonicalAddressRegistry",
  contract: Teller | DepositManager | CanonicalAddressRegistry
): Promise<void> {
  const [, name, version] = await contract.eip712Domain();

  const expectedName = `Nocturne${contractName}`;
  const expectedVersion = "v1";

  assertOrErr(
    name === expectedName,
    `eip712 name does not match config: ${name} != ${expectedName}`
  );
  assertOrErr(
    version === expectedVersion,
    `eip712 version does not match config: ${version} != ${expectedVersion}`
  );
}

async function checkErc20Caps(
  depositManager: DepositManager,
  erc20s: Map<string, Erc20Config>
): Promise<void> {
  for (const [ticker, config] of erc20s.entries()) {
    console.log(`checking deposit manager cap for ${ticker}`);
    const { globalCapWholeTokens, maxDepositSizeWholeTokens, precision } =
      await depositManager._erc20Caps(config.address);
    assertOrErr(
      BigInt(globalCapWholeTokens) === config.globalCapWholeTokens,
      `global cap for ${ticker} does not match config: ${BigInt(
        globalCapWholeTokens
      )} != ${config.globalCapWholeTokens}`
    );
    assertOrErr(
      BigInt(maxDepositSizeWholeTokens) === config.maxDepositSizeWholeTokens,
      `max deposit size for ${ticker} does not match config: ${BigInt(
        maxDepositSizeWholeTokens
      )} != ${config.maxDepositSizeWholeTokens}`
    );
    assertOrErr(
      BigInt(precision) === config.precision,
      `precision for ${ticker} does not match config: ${BigInt(precision)} != ${
        config.precision
      }`
    );
  }
}

async function checkProtocolAllowlist(
  handler: Handler,
  erc20s: Map<string, Erc20Config>,
  protocolAllowlist: Map<string, ProtocolAddressWithMethods>
): Promise<void> {
  for (const [ticker, { address }] of erc20s.entries()) {
    console.log(`checking contract for ${ticker} is whitelisted`);
    const tokenSupported = await handler._supportedContracts(address);
    assertOrErr(
      tokenSupported,
      `erc20 ${ticker} is not on the allowlist. Address: ${address}`
    );

    const approveKey = protocolWhitelistKey(address, "0x095ea7b3");
    const transferKey = protocolWhitelistKey(address, "0xa9059cbb");

    const approveOnAllowlist = await handler._supportedContractMethods(
      approveKey
    );
    assertOrErr(
      approveOnAllowlist,
      `erc20 ${ticker} is not on the allowlist. Address: ${address}. Signature: ${approveKey}`
    );

    const transferOnAllowlist = await handler._supportedContractMethods(
      transferKey
    );
    assertOrErr(
      transferOnAllowlist,
      `erc20 ${ticker} is not on the allowlist. Address: ${address}. Signature: ${transferKey}`
    );
  }

  for (const [name, { address, functionSignatures }] of protocolAllowlist) {
    for (const signature of functionSignatures) {
      console.log(
        `checking protocol allowlist method. name: ${name}. function signature: ${signature}`
      );
      const selector = getSelector(signature);
      const key = protocolWhitelistKey(address, selector);
      const isOnAllowlist = await handler._supportedContractMethods(key);
      assertOrErr(
        isOnAllowlist,
        `Protocol ${name} is not on the allowlist. Address: ${address}`
      );
    }
  }
}

async function checkNocturneAdapterStateVars(
  deployConfig: NocturneDeployConfig,
  config: NocturneConfig,
  provider: ethers.providers.Provider
): Promise<void> {
  const ethTransferAdapterAddress =
    config.protocolAllowlist.get("ETHTransferAdapter")!.address;
  const ethTransferAdapter = EthTransferAdapter__factory.connect(
    ethTransferAdapterAddress,
    provider
  );

  console.log("checking eth transfer adapter weth matches config");
  const ethTransferAdapterWeth = await ethTransferAdapter._weth();
  assertOrErr(
    ethTransferAdapterWeth === config.erc20s.get("WETH")!.address,
    "eth transfer adapter weth does not match deployment"
  );

  const maybeUniswapV3AdapterAddress =
    config.protocolAllowlist.get("UniswapV3Adapter")?.address;
  if (maybeUniswapV3AdapterAddress) {
    const uniswapV3Adapter = UniswapV3Adapter__factory.connect(
      maybeUniswapV3AdapterAddress,
      provider
    );

    console.log("checking uniswap v3 adapter owner matches config owner");
    const uniswapV3AdapterOwner = await uniswapV3Adapter.owner();
    assertOrErr(
      uniswapV3AdapterOwner === config.contracts.owners.contractOwner,
      "uniswap v3 adapter owner does not match deployment"
    );

    for (const [ticker, { address }] of config.erc20s) {
      console.log(`checking uniswap v3 adapter supports token ${ticker}`);
      const isTokenSupported = await uniswapV3Adapter._allowedTokens(address);
      assertOrErr(
        isTokenSupported,
        `uniswap v3 adapter does not support token ${address}`
      );
    }

    console.log(
      "checking uniswap v3 adapter swap router is actual swap router in config"
    );
    const uniswapV3AdapterSwapRouter = await uniswapV3Adapter._swapRouter();
    assertOrErr(
      uniswapV3AdapterSwapRouter ===
        deployConfig.opts!.uniswapV3AdapterDeployConfig!.swapRouterAddress,
      "uniswap v3 adapter swap router does not match deployment"
    );
  }

  console.log(
    "checking reth adapter weth and rocket storage match real contracts in config"
  );
  const maybeRethAdapterAddress = config.protocolAllowlist.get("rETHAdapter");
  if (maybeRethAdapterAddress) {
    const rethAdapter = RethAdapter__factory.connect(
      maybeRethAdapterAddress.address,
      provider
    );

    console.log("checking reth adapter weth is real weth in config");
    const rethAdapterWeth = await rethAdapter._weth();
    assertOrErr(
      rethAdapterWeth === config.erc20s.get("WETH")!.address,
      "reth adapter weth does not match deployment"
    );

    console.log(
      "checking reth adapter rocket storage is real rocket storage in config"
    );
    const rethAdapterRocketStorage = await rethAdapter._rocketStorage();
    assertOrErr(
      rethAdapterRocketStorage ===
        deployConfig.opts!.rethAdapterDeployConfig!.rocketPoolStorageAddress,
      "reth adapter rocket storage does not match deployment"
    );
  }

  // Wsteth adapter weth and wsteth match config
  if (config.protocolAllowlist.get("wstETHAdapter")) {
    const wstethAdapter = WstethAdapter__factory.connect(
      config.protocolAllowlist.get("wstETHAdapter")!.address,
      provider
    );

    const wstethAdapterWeth = await wstethAdapter._weth();
    const wstethAdapterWsteth = await wstethAdapter._wsteth();

    console.log("checking wsteth adapter weth is real weth in config");
    assertOrErr(
      wstethAdapterWeth === config.erc20s.get("WETH")!.address,
      "wsteth adapter weth does not match deployment"
    );

    console.log("checking wsteth adapter wsteth is real wsteth in config");
    assertOrErr(
      wstethAdapterWsteth === config.erc20s.get("wstETH")!.address,
      "wsteth adapter wsteth does not match deployment"
    );
  }
}
