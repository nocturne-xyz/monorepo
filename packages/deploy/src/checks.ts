import {
  DepositManager__factory,
  Handler__factory,
  ProxyAdmin__factory,
  Teller__factory,
} from "@nocturne-xyz/contracts";
import { ethers } from "ethers";
import { NocturneContractDeployment } from "@nocturne-xyz/config";
import { proxyAdmin, proxyImplementation } from "./proxyUtils";
import { assertOrErr } from "./utils";

export async function checkNocturneContractDeployment(
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
