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
import { Address } from "./utils";

export interface NocturneDeployArgs {
  proxyAdminOwner: Address;
  walletOwner: Address;
  handlerOwner: Address;
  depositManagerOwner: Address;
  screeners: Address[];
  subtreeBatchFillers: Address[];
}

export interface NocturneDeployOpts {
  proxyAdmin?: ProxyAdmin;
  provider?: any; // FIX: ts build within hh disallows ethers.providers.Provider
  useMockSubtreeUpdateVerifier?: boolean;
  confirmations?: number;
}

export async function deployNocturne(
  connectedSigner: ethers.Wallet,
  args: NocturneDeployArgs,
  opts?: NocturneDeployOpts
): Promise<NocturneContractDeployment> {
  if (!connectedSigner.provider)
    throw new Error("Wallet must be connected to provider");

  const { name, chainId } = await connectedSigner.provider.getNetwork();
  const startBlock = await connectedSigner.provider.getBlockNumber();

  // Maybe deploy proxy admin
  let proxyAdmin = opts?.proxyAdmin;
  if (!proxyAdmin) {
    console.log("\nDeploying ProxyAdmin");
    proxyAdmin = await new ProxyAdmin__factory(connectedSigner).deploy();
    const tx = await proxyAdmin.transferOwnership(args.proxyAdminOwner);
    await tx.wait(opts?.confirmations);
  }

  // Deploy handler proxy, un-initialized
  console.log("\nDeploying proxied Handler");
  const proxiedHandler = await deployProxiedContract(
    new Handler__factory(connectedSigner),
    proxyAdmin
  );
  console.log("Deployed proxied Handler:", proxiedHandler.proxyAddresses);

  console.log("\nDeploying JoinSplitVerifier");
  const joinSplitVerifier = await new JoinSplitVerifier__factory(
    connectedSigner
  ).deploy();
  await joinSplitVerifier.deployTransaction.wait(opts?.confirmations);

  let subtreeUpdateVerifier: SubtreeUpdateVerifier | TestSubtreeUpdateVerifier;
  console.log("\nDeploying SubtreeUpdateVerifier");
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

  console.log("\nDeploying proxied Wallet");
  const proxiedWallet = await deployProxiedContract(
    new Wallet__factory(connectedSigner),
    proxyAdmin,
    [proxiedHandler.address, joinSplitVerifier.address]
  );
  console.log("Deployed proxied Wallet:", proxiedWallet.proxyAddresses);

  console.log("Initializing proxied Handler");
  const handlerInitTx = await proxiedHandler.contract.initialize(
    proxiedWallet.address,
    subtreeUpdateVerifier.address
  );
  await handlerInitTx.wait(opts?.confirmations);

  console.log("\nDeploying proxied DepositManager");
  const proxiedDepositManager = await deployProxiedContract(
    new DepositManager__factory(connectedSigner),
    proxyAdmin,
    ["NocturneDepositManager", "v1", proxiedWallet.address]
  );
  console.log(
    "Deployed proxied DepositManager:",
    proxiedDepositManager.proxyAddresses
  );

  console.log("Setting deposit manager screeners\n");
  for (const screener of args.screeners) {
    const tx = await proxiedDepositManager.contract.setScreenerPermission(
      screener,
      true
    );
    await tx.wait(opts?.confirmations);
  }

  console.log("setting subtre batch fillers\n");
  for (const filler of args.subtreeBatchFillers) {
    const tx = await proxiedWallet.contract.setSubtreeBatchFillerPermission(
      filler,
      true
    );
    await tx.wait(opts?.confirmations);
  }

  console.log("Adding deposit manager to wallet deposit sources\n");
  const enrollDepositManagerTx =
    await proxiedWallet.contract.setDepositSourcePermission(
      proxiedDepositManager.address,
      true
    );
  await enrollDepositManagerTx.wait(opts?.confirmations);

  console.log(
    "Relinquishing control of wallet, handler, and deposit manager\n"
  );
  const walletTransferOwnershipTx =
    await proxiedWallet.contract.transferOwnership(args.walletOwner);
  await walletTransferOwnershipTx.wait(opts?.confirmations);

  const handlerTransferOwnershipTx =
    await proxiedHandler.contract.transferOwnership(args.handlerOwner);
  await handlerTransferOwnershipTx.wait(opts?.confirmations);

  const depositManagerTransferOwnershipTx =
    await proxiedDepositManager.contract.transferOwnership(
      args.depositManagerOwner
    );
  await depositManagerTransferOwnershipTx.wait(opts?.confirmations);

  return {
    network: {
      name,
      chainId,
    },
    startBlock,
    owners: {
      proxyAdminOwner: args.proxyAdminOwner,
      walletOwner: args.walletOwner,
      handlerOwner: args.handlerOwner,
      depositManagerOwner: args.depositManagerOwner,
    },
    proxyAdmin: proxyAdmin.address,
    depositManagerProxy: proxiedDepositManager.proxyAddresses,
    walletProxy: proxiedWallet.proxyAddresses,
    handlerProxy: proxiedHandler.proxyAddresses,
    joinSplitVerifierAddress: joinSplitVerifier.address,
    subtreeUpdateVerifierAddress: subtreeUpdateVerifier.address,
    screeners: args.screeners,
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
