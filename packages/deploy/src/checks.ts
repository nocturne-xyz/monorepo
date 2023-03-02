import { ProxyAdmin__factory, Wallet__factory } from "@nocturne-xyz/contracts";
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
    proxyAdminOwnerActual === deployment.proxyAdminOwner,
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

  // Vault proxy admin matches deployment proxy admin
  const vaultProxyAdmin = await proxyAdmin(
    provider,
    deployment.vaultProxy.proxy
  );
  assertOrErr(
    vaultProxyAdmin === deployment.proxyAdmin,
    "Vault proxy admin incorrectly set"
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

  // Vault proxy implementation matches deployment
  const vaultProxyImplementation = await proxyImplementation(
    provider,
    deployment.vaultProxy.proxy
  );
  assertOrErr(
    vaultProxyImplementation === deployment.vaultProxy.implementation,
    "Vault proxy implementation does not match deployment"
  );

  const walletContract = Wallet__factory.connect(
    deployment.walletProxy.proxy,
    provider
  );

  // Wallet joinsplit verifier matches deployment
  const walletJoinSplitVerifier = await walletContract._joinSplitVerifier();
  assertOrErr(
    walletJoinSplitVerifier === deployment.joinSplitVerifier,
    "Wallet joinsplit verifier does not match deployment"
  );

  // TODO: is there a way to check subtree update verifier?
}
