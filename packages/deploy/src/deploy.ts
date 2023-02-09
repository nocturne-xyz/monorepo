import {
  JoinSplitVerifier__factory,
  ProxyAdmin,
  ProxyAdmin__factory,
  SubtreeUpdateVerifier,
  SubtreeUpdateVerifier__factory,
  TestSubtreeUpdateVerifier,
  TestSubtreeUpdateVerifier__factory,
  TransparentUpgradeableProxy__factory,
  Vault__factory,
  Wallet__factory,
} from "@nocturne-xyz/contracts";
import { ethers } from "ethers";
import { ProxiedContract, ProxyKind, TransparentProxyAddresses } from "./proxy";
import { Address, NocturneDeploymentConfig } from "./deployment";

export interface NocturneDeployOpts {
  proxyAdmin?: ProxyAdmin;
  provider?: any; // FIX: ts build within hh disallows ethers.providers.Provider
  useMockSubtreeUpdateVerifier?: boolean;
  confirmations?: number;
}

export class NocturneDeployer {
  connectedSigner: ethers.Wallet;

  constructor(connectedSigner: ethers.Wallet) {
    if (!connectedSigner.provider)
      throw new Error("Wallet must be connected to provider");
    this.connectedSigner = connectedSigner;
  }

  async deployNocturne(
    proxyAdminOwner: Address,
    opts?: NocturneDeployOpts
  ): Promise<NocturneDeploymentConfig> {
    const { name, chainId } = await this.connectedSigner.provider.getNetwork();
    const startBlock = await this.connectedSigner.provider.getBlockNumber();

    // Maybe deploy proxy admin
    let proxyAdmin = opts?.proxyAdmin;
    if (!proxyAdmin) {
      console.log("\nDeploying ProxyAdmin");
      proxyAdmin = await new ProxyAdmin__factory(this.connectedSigner).deploy();
      const tx = await proxyAdmin.transferOwnership(proxyAdminOwner);
      await tx.wait(opts?.confirmations);
    }

    // Deploy vault proxy, un-initialized
    console.log("\nDeploying proxied Vault");
    const proxiedVault = await this.deployProxiedContract(
      new Vault__factory(this.connectedSigner),
      proxyAdmin
    );
    console.log("Deployed proxied Vault:", proxiedVault.proxyAddresses);

    console.log("\nDeploying JoinSplitVerifier");
    const joinSplitVerifier = await new JoinSplitVerifier__factory(
      this.connectedSigner
    ).deploy();
    await joinSplitVerifier.deployTransaction.wait(opts?.confirmations);

    let subtreeUpdateVerifier:
      | SubtreeUpdateVerifier
      | TestSubtreeUpdateVerifier;
    console.log("\nDeploying SubtreeUpdateVerifier");
    if (opts?.useMockSubtreeUpdateVerifier) {
      subtreeUpdateVerifier = await new TestSubtreeUpdateVerifier__factory(
        this.connectedSigner
      ).deploy();
    } else {
      subtreeUpdateVerifier = await new SubtreeUpdateVerifier__factory(
        this.connectedSigner
      ).deploy();
    }
    await subtreeUpdateVerifier.deployTransaction.wait(opts?.confirmations);

    console.log("\nDeploying proxied Wallet");
    const proxiedWallet = await this.deployProxiedContract(
      new Wallet__factory(this.connectedSigner),
      proxyAdmin,
      [
        proxiedVault.address,
        joinSplitVerifier.address,
        subtreeUpdateVerifier.address,
      ]
    );
    console.log("Deployed proxied Wallet:", proxiedWallet.proxyAddresses);

    console.log("Initializing proxied Vault");
    const vaultInitTx = await proxiedVault.contract.initialize(
      proxiedWallet.address
    );
    await vaultInitTx.wait(opts?.confirmations);

    return {
      network: {
        name,
        chainId,
      },
      startBlock,
      proxyAdminOwner,
      proxyAdmin: proxyAdmin.address,
      walletProxy: proxiedWallet.proxyAddresses,
      vaultProxy: proxiedVault.proxyAddresses,
      joinSplitVerifier: joinSplitVerifier.address,
      subtreeUpdateVerifier: subtreeUpdateVerifier.address,
    };
  }

  async deployProxiedContract<
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
      this.connectedSigner
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
}
