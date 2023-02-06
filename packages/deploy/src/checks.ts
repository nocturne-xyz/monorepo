import { ProxyAdmin__factory, Wallet__factory } from "@nocturne-xyz/contracts";
import { ethers } from "ethers";
import { NocturneDeployment } from "./deployment";
import { proxyAdmin, proxyImplementation } from "./proxyUtils";
import { assert } from "./utils";

export async function checkNocturneDeployment(
  deployment: NocturneDeployment,
  provider: ethers.providers.Provider
): Promise<void> {
  // Proxy admin owner matches deployment
  const proxyAdminContract = ProxyAdmin__factory.connect(
    deployment.proxyAdmin,
    provider
  );
  const proxyAdminOwnerActual = await proxyAdminContract.owner();
  assert(
    proxyAdminOwnerActual === deployment.proxyAdminOwner,
    "Proxy admin owner inconsistent"
  );

  // Wallet proxy admin matches deployment proxy admin
  const walletProxyAdmin = await proxyAdmin(
    provider,
    deployment.walletProxy.proxy
  );
  assert(
    walletProxyAdmin === deployment.proxyAdmin,
    "Wallet proxy admin incorrectly set"
  );

  // Vault proxy admin matches deployment proxy admin
  const vaultProxyAdmin = await proxyAdmin(
    provider,
    deployment.vaultProxy.proxy
  );
  assert(
    vaultProxyAdmin === deployment.proxyAdmin,
    "Vault proxy admin incorrectly set"
  );

  // Wallet proxy implementation matches deployment
  const walletProxyImplementation = await proxyImplementation(
    provider,
    deployment.walletProxy.proxy
  );
  assert(
    walletProxyImplementation === deployment.walletProxy.implementation,
    "Wallet proxy implementation does not match deployment"
  );

  // Vault proxy implementation matches deployment
  const vaultProxyImplementation = await proxyImplementation(
    provider,
    deployment.vaultProxy.proxy
  );
  assert(
    vaultProxyImplementation === deployment.vaultProxy.implementation,
    "Vault proxy implementation does not match deployment"
  );

  const walletContract = Wallet__factory.connect(
    deployment.walletProxy.proxy,
    provider
  );

  // Wallet joinsplit verifier matches deployment
  const walletJoinSplitVerifier = await walletContract._joinSplitVerifier();
  assert(
    walletJoinSplitVerifier === deployment.joinSplitVerifier,
    "Wallet joinsplit verifier does not match deployment"
  );

  // TODO: is there a way to check subtree update verifier?
}
