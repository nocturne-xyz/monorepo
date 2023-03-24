import {
  DepositManager__factory,
  ProxyAdmin__factory,
  Wallet__factory,
} from "@nocturne-xyz/contracts";
import { ethers } from "ethers";
import { NocturneContractDeployment } from "@nocturne-xyz/config";
import { proxyAdmin, proxyImplementation } from "./proxyUtils";
import { assertOrErr } from "./utils";

export async function checkNocturneContractDeployment(
  deployment: NocturneContractDeployment,
  provider: ethers.providers.Provider
): Promise<void> {
  // Proxy admin owner matches deployment
  const proxyAdminContract = ProxyAdmin__factory.connect(
    deployment.proxyAdmin,
    provider
  );
  const proxyAdminOwnerActual = await proxyAdminContract.owner();
  assertOrErr(
    proxyAdminOwnerActual === deployment.owners.proxyAdminOwner,
    "Proxy admin owner inconsistent"
  );

  // Wallet proxy admin matches deployment proxy admin
  const walletProxyAdmin = await proxyAdmin(
    provider,
    deployment.walletProxy.proxy
  );
  assertOrErr(
    walletProxyAdmin === deployment.proxyAdmin,
    "Wallet proxy admin incorrectly set"
  );

  // Handler proxy admin matches deployment proxy admin
  const handlerProxyAdmin = await proxyAdmin(
    provider,
    deployment.handlerProxy.proxy
  );
  assertOrErr(
    handlerProxyAdmin === deployment.proxyAdmin,
    "Handler proxy admin incorrectly set"
  );

  // Wallet proxy implementation matches deployment
  const walletProxyImplementation = await proxyImplementation(
    provider,
    deployment.walletProxy.proxy
  );
  assertOrErr(
    walletProxyImplementation === deployment.walletProxy.implementation,
    "Wallet proxy implementation does not match deployment"
  );

  // Handler proxy implementation matches deployment
  const handlerProxyImplementation = await proxyImplementation(
    provider,
    deployment.handlerProxy.proxy
  );
  assertOrErr(
    handlerProxyImplementation === deployment.handlerProxy.implementation,
    "Handler proxy implementation does not match deployment"
  );

  const walletContract = Wallet__factory.connect(
    deployment.walletProxy.proxy,
    provider
  );

  // Wallet joinsplit verifier matches deployment
  const walletJoinSplitVerifier = await walletContract._joinSplitVerifier();
  assertOrErr(
    walletJoinSplitVerifier === deployment.joinSplitVerifierAddress,
    "Wallet joinsplit verifier does not match deployment"
  );

  const depositManagerContract = DepositManager__factory.connect(
    deployment.depositManagerProxy.proxy,
    provider
  );

  // Wallet whitelisted deposit manager as source
  const hasDepositManager = await walletContract._depositSources(
    depositManagerContract.address
  );
  assertOrErr(
    hasDepositManager,
    "Wallet did not whitelist deposit manager as deposit source"
  );

  // Deposit manager whitelisted screeners
  for (const screener of deployment.screeners) {
    const hasScreener = await depositManagerContract._screeners(screener);
    assertOrErr(
      hasScreener,
      `DepositManager did not whitelist screener ${screener}`
    );
  }

  // Ensure owners are set
  const walletOwner = await walletContract.owner();
  assertOrErr(
    walletOwner == deployment.owners.walletOwner,
    "On-chain wallet owner doesn't match config wallet owner"
  );

  const depositManagerOwner = await depositManagerContract.owner();
  assertOrErr(
    depositManagerOwner == deployment.owners.depositManagerOwner,
    "On-chain deposit manager owner doesn't match config deposit manager owner"
  );

  // TODO: is there a way to check subtree update verifier?
}
