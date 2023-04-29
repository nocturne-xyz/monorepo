import {
  JoinSplitVerifier__factory,
  ProxyAdmin,
  ProxyAdmin__factory,
  SubtreeUpdateVerifier,
  SubtreeUpdateVerifier__factory,
  TestSubtreeUpdateVerifier,
  TestSubtreeUpdateVerifier__factory,
  TransparentUpgradeableProxy__factory,
  Handler__factory,
  Wallet__factory,
  DepositManager__factory,
} from "@nocturne-xyz/contracts";
import { ethers } from "ethers";
import { ProxiedContract } from "./proxy";
import {
  ProxyKind,
  TransparentProxyAddresses,
  NocturneContractDeployment,
} from "@nocturne-xyz/config";
import { NocturneDeployConfig, NocturneDeployOpts } from "./config";

export async function deployNocturne(
  connectedSigner: ethers.Wallet,
  config: NocturneDeployConfig
): Promise<NocturneContractDeployment> {
  if (!connectedSigner.provider)
    throw new Error("ethers.Wallet must be connected to provider");

  console.log("\ngetting network...");
  const { name, chainId } = await connectedSigner.provider.getNetwork();
  console.log("\nfetching current block number...");
  const startBlock = await connectedSigner.provider.getBlockNumber();

  // Maybe deploy proxy admin
  const { opts } = config;
  let proxyAdmin = opts?.proxyAdmin;
  if (!proxyAdmin) {
    console.log("\ndeploying ProxyAdmin...");
    proxyAdmin = await new ProxyAdmin__factory(connectedSigner).deploy();
    const tx = await proxyAdmin.transferOwnership(config.proxyAdminOwner);
    await tx.wait(opts?.confirmations);
  }

  // Deploy handler proxy, un-initialized
  console.log("\ndeploying proxied Handler...");
  const proxiedHandler = await deployProxiedContract(
    new Handler__factory(connectedSigner),
    proxyAdmin
  );
  console.log("\ndeployed proxied Handler:", proxiedHandler.proxyAddresses);

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

  console.log("\ndeploying proxied Wallet...");
  const proxiedWallet = await deployProxiedContract(
    new Wallet__factory(connectedSigner),
    proxyAdmin,
    [proxiedHandler.address, joinSplitVerifier.address] // initialize here
  );
  console.log("deployed proxied Wallet:", proxiedWallet.proxyAddresses);

  console.log("\ninitializing proxied Handler");
  const handlerInitTx = await proxiedHandler.contract.initialize(
    proxiedWallet.address,
    subtreeUpdateVerifier.address
  );
  await handlerInitTx.wait(opts?.confirmations);

  console.log("\ndeploying proxied DepositManager...");
  const proxiedDepositManager = await deployProxiedContract(
    new DepositManager__factory(connectedSigner),
    proxyAdmin,
    ["NocturneDepositManager", "v1", proxiedWallet.address, config.wethAddress] // initialize here
  );
  console.log(
    "deployed proxied DepositManager:",
    proxiedDepositManager.proxyAddresses
  );

  console.log("\nsetting deposit manager screeners...");
  for (const screener of config.screeners) {
    const tx = await proxiedDepositManager.contract.setScreenerPermission(
      screener,
      true
    );
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

  console.log("\nadding deposit manager to wallet deposit sources...");
  const enrollDepositManagerTx =
    await proxiedWallet.contract.setDepositSourcePermission(
      proxiedDepositManager.address,
      true
    );
  await enrollDepositManagerTx.wait(opts?.confirmations);

  console.log(
    "\nrelinquishing control of wallet, handler, and deposit manager..."
  );
  const walletTransferOwnershipTx =
    await proxiedWallet.contract.transferOwnership(config.proxyAdminOwner);
  await walletTransferOwnershipTx.wait(opts?.confirmations);

  const handlerTransferOwnershipTx =
    await proxiedHandler.contract.transferOwnership(config.proxyAdminOwner);
  await handlerTransferOwnershipTx.wait(opts?.confirmations);

  const depositManagerTransferOwnershipTx =
    await proxiedDepositManager.contract.transferOwnership(
      config.proxyAdminOwner
    );
  await depositManagerTransferOwnershipTx.wait(opts?.confirmations);

  return {
    network: {
      name,
      chainId,
    },
    startBlock,
    owners: {
      proxyAdminOwner: config.proxyAdminOwner,
      walletOwner: config.proxyAdminOwner,
      handlerOwner: config.proxyAdminOwner,
      depositManagerOwner: config.proxyAdminOwner,
    },
    proxyAdmin: proxyAdmin.address,
    depositManagerProxy: proxiedDepositManager.proxyAddresses,
    walletProxy: proxiedWallet.proxyAddresses,
    handlerProxy: proxiedHandler.proxyAddresses,
    joinSplitVerifierAddress: joinSplitVerifier.address,
    subtreeUpdateVerifierAddress: subtreeUpdateVerifier.address,
    screeners: config.screeners,
    depositSources: [proxiedDepositManager.address],
  };
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
    }
  );
}
