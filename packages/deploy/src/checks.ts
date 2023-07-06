import {
  DepositManager,
  DepositManager__factory,
  Handler,
  Handler__factory,
  ProxyAdmin__factory,
  Teller__factory,
} from "@nocturne-xyz/contracts";
import { ethers } from "ethers";
import {
  NocturneContractDeployment,
  Erc20Config,
  ProtocolAddressWithMethods,
} from "@nocturne-xyz/config";
import { proxyAdmin, proxyImplementation } from "./proxyUtils";
import { assertOrErr, getSelector } from "./utils";
import { NocturneConfig } from "@nocturne-xyz/config/dist/src/config";
import { protocolWhitelistKey } from "@nocturne-xyz/sdk";

export async function checkNocturneDeployment(
  config: NocturneConfig,
  provider: ethers.providers.Provider
): Promise<void> {
  const depositManager = DepositManager__factory.connect(
    config.contracts.depositManagerProxy.proxy,
    provider
  );
  const handler = Handler__factory.connect(
    config.contracts.handlerProxy.proxy,
    provider
  );

  await checkNocturneContracts(config.contracts, provider);
  await checkErc20Caps(depositManager, config.erc20s);
  await checkProtocolAllowlist(
    handler,
    config.erc20s,
    config.protocolAllowlist
  );
}

async function checkNocturneContracts(
  deployment: NocturneContractDeployment,
  provider: ethers.providers.Provider
): Promise<void> {
  const tellerContract = Teller__factory.connect(
    deployment.tellerProxy.proxy,
    provider
  );
  const handlerContract = Handler__factory.connect(
    deployment.handlerProxy.proxy,
    provider
  );
  const depositManagerContract = DepositManager__factory.connect(
    deployment.depositManagerProxy.proxy,
    provider
  );

  // Proxy admin owner matches deployment
  const proxyAdminContract = ProxyAdmin__factory.connect(
    deployment.proxyAdmin,
    provider
  );
  const proxyAdminOwnerActual = await proxyAdminContract.owner();
  assertOrErr(
    proxyAdminOwnerActual === deployment.owners.proxyAdminOwner,
    "proxy admin owner inconsistent"
  );

  // Teller proxy admin matches deployment proxy admin
  const tellerProxyAdmin = await proxyAdmin(
    provider,
    deployment.tellerProxy.proxy
  );
  assertOrErr(
    tellerProxyAdmin === deployment.proxyAdmin,
    "teller proxy admin incorrectly set"
  );

  // Handler proxy admin matches deployment proxy admin
  const handlerProxyAdmin = await proxyAdmin(
    provider,
    deployment.handlerProxy.proxy
  );
  assertOrErr(
    handlerProxyAdmin === deployment.proxyAdmin,
    "handler proxy admin incorrectly set"
  );

  // Teller proxy implementation matches deployment
  const tellerProxyImplementation = await proxyImplementation(
    provider,
    deployment.tellerProxy.proxy
  );
  assertOrErr(
    tellerProxyImplementation === deployment.tellerProxy.implementation,
    "teller proxy implementation does not match deployment"
  );

  // Handler proxy implementation matches deployment
  const handlerProxyImplementation = await proxyImplementation(
    provider,
    deployment.handlerProxy.proxy
  );
  assertOrErr(
    handlerProxyImplementation === deployment.handlerProxy.implementation,
    "handler proxy implementation does not match deployment"
  );

  // Teller joinsplit verifier matches deployment
  const tellerJoinSplitVerifier = await tellerContract._joinSplitVerifier();
  assertOrErr(
    tellerJoinSplitVerifier === deployment.joinSplitVerifierAddress,
    "teller joinsplit verifier does not match deployment"
  );

  // Teller whitelisted deposit manager as source
  const hasDepositManager = await tellerContract._depositSources(
    depositManagerContract.address
  );
  assertOrErr(
    hasDepositManager,
    "teller did not whitelist deposit manager as deposit source"
  );

  // Deposit manager whitelisted screeners
  for (const screener of deployment.screeners) {
    const hasScreener = await depositManagerContract._screeners(screener);
    assertOrErr(
      hasScreener,
      `depositManager did not whitelist screener ${screener}`
    );
  }

  // Ensure owners are set
  const tellerOwner = await tellerContract.owner();
  assertOrErr(
    tellerOwner == deployment.owners.tellerOwner,
    "on-chain teller owner doesn't match config teller owner"
  );

  const handlerOwner = await handlerContract.owner();
  assertOrErr(
    handlerOwner == deployment.owners.handlerOwner,
    "on-chain handler owner doesn't match config handler owner"
  );

  const depositManagerOwner = await depositManagerContract.owner();
  assertOrErr(
    depositManagerOwner == deployment.owners.depositManagerOwner,
    "on-chain deposit manager owner doesn't match config deposit manager owner"
  );

  // TODO: is there a way to check subtree update verifier?
}

async function checkErc20Caps(
  depositManager: DepositManager,
  erc20s: Map<string, Erc20Config>
): Promise<void> {
  for (const [ticker, config] of erc20s.entries()) {
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
    const zeroKey = protocolWhitelistKey(address, "0x00000000");
    const approveKey = protocolWhitelistKey(address, "0x095ea7b3");
    const transferKey = protocolWhitelistKey(address, "0xa9059cbb");

    const zeroOnAllowlist = await handler._supportedContractAllowlist(zeroKey);
    assertOrErr(
      zeroOnAllowlist,
      `erc20 ${ticker} is not on the allowlist. Address: ${address}. Signature: ${zeroKey}`
    );

    const approveOnAllowlist = await handler._supportedContractAllowlist(
      approveKey
    );
    assertOrErr(
      approveOnAllowlist,
      `erc20 ${ticker} is not on the allowlist. Address: ${address}. Signature: ${approveKey}`
    );

    const transferOnAllowlist = await handler._supportedContractAllowlist(
      transferKey
    );
    assertOrErr(
      transferOnAllowlist,
      `erc20 ${ticker} is not on the allowlist. Address: ${address}. Signature: ${transferKey}`
    );
  }

  for (const [name, { address, functionSignatures }] of protocolAllowlist) {
    for (const signature of functionSignatures) {
      const selector = getSelector(signature);
      const key = protocolWhitelistKey(address, selector);
      const isOnAllowlist = await handler._supportedContractAllowlist(key);
      assertOrErr(
        isOnAllowlist,
        `Protocol ${name} is not on the allowlist. Address: ${address}`
      );
    }
  }
}
