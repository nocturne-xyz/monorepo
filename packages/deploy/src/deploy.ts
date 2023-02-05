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
import { Address, NocturneDeployment, NocturneDeployOpts } from "./types";

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
  ): Promise<NocturneDeployment> {
    const { name, chainId } = await this.connectedSigner.provider.getNetwork();
    const startBlock = await this.connectedSigner.provider.getBlockNumber();

    // Maybe deploy proxy admin
    let proxyAdmin = opts?.proxyAdmin;
    if (!proxyAdmin) {
      console.log("\nDeploying ProxyAdmin");
      proxyAdmin = await new ProxyAdmin__factory(this.connectedSigner).deploy();
      await proxyAdmin.transferOwnership(proxyAdminOwner);
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
    await proxiedVault.contract.initialize(proxiedWallet.address);

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
    initArgs?: Parameters<C["initialize"]>
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

    return new ProxiedContract<C, TransparentProxyAddresses>(
      implementation.attach(proxy.address) as C,
      {
        kind: ProxyKind.Transparent,
        proxy: proxy.address,
        implementation: implementation.address,
      }
    );
  }

  async deployContractFromFactory<F extends ethers.ContractFactory>(
    factory: F,
    constructorArgs: Parameters<F["deploy"]>
  ): Promise<ReturnType<F["deploy"]>> {
    const contract = await factory.deploy(...constructorArgs);
    return contract as ReturnType<F["deploy"]>;
  }
}

/*
import { NocturneDeployment, NocturneDeployOpts } from './types';
import { upgrades, ethers } from 'hardhat';
import * as dotenv from 'dotenv';
import { ProxyAdmin__factory } from '../src/factories/ProxyAdmin__factory';
import { Vault__factory } from '../src/factories/Vault__factory';
import { JoinSplitVerifier__factory } from '../src/factories/JoinSplitVerifier__factory';
import { TestSubtreeUpdateVerifier__factory } from '../src/factories/TestSubtreeUpdateVerifier__factory';
import { SubtreeUpdateVerifier__factory } from '../src/factories/SubtreeUpdateVerifier__factory';
import { Wallet__factory } from '../src/factories/Wallet__factory';

dotenv.config();

export async function deployNocturne(
  network: string,
  proxyAdminOwner: string,
  opts?: NocturneDeployOpts,
): Promise<NocturneDeployment> {
  const deployerKey = process.env.DEPLOYER_KEY;
  if (!deployerKey) throw new Error('Deploy script missing deployer key');

  let provider = opts?.provider;
  if (!provider) {
    const rpcUrlName = `${network.toUpperCase()}_RPC_URL`;
    const rpcUrl = process.env[rpcUrlName];
    if (!rpcUrl) throw new Error('Deploy script missing rpc url');
    provider = ethers.providers.getDefaultProvider(rpcUrl);
  }

  const { name, chainId } = await provider.getNetwork();
  const startBlock = await provider.getBlockNumber();

  const deployer = new ethers.Wallet(deployerKey, provider);

  // Maybe deploy proxy admin
  let proxyAdmin = opts?.proxyAdmin;
  if (!proxyAdmin) {
    console.log('\nDeploying ProxyAdmin');
    const ProxyAdmin = new ProxyAdmin__factory(deployer);
    proxyAdmin = await ProxyAdmin.deploy();
    console.log('ProxyAdmin deployed to:', proxyAdmin.address);
  }

  // Deploy Vault
  console.log('\nDeploying Vault');
  const Vault = new Vault__factory(deployer);
  const vaultProxy = await upgrades.deployProxy(Vault, {
    initializer: false,
    kind: 'transparent',
  });
  await vaultProxy.deployed();
  console.log('Vault proxy deployed to:', vaultProxy.address);

  const vaultImplementationAddress =
    await upgrades.erc1967.getImplementationAddress(vaultProxy.address);
  console.log('Vault implementation deployed to:', vaultImplementationAddress);

  const vaultAdminAddress = await upgrades.erc1967.getAdminAddress(
    vaultProxy.address,
  );
  console.log('Vault proxy admin currently set to:', vaultAdminAddress);

  await upgrades.admin.changeProxyAdmin(vaultProxy.address, proxyAdmin.address);
  console.log('Vault proxy admin changed to:', proxyAdmin.address);

  // Deploy JoinSplitVerifier
  console.log('\nDeploying JoinSplitVerifier');
  const JoinSplitVerifier = new JoinSplitVerifier__factory(deployer);
  const joinSplitVerifier = await JoinSplitVerifier.deploy();
  await joinSplitVerifier.deployed();
  console.log('JoinSplitVerifier deployed to:', joinSplitVerifier.address);

  // Deploy SubtreeUpdateVerifier
  console.log('\nDeploying SubtreeUpdateVerifier');
  let SubtreeUpdateVerifier;
  if (opts?.useMockSubtreeUpdateVerifier) {
    SubtreeUpdateVerifier = new TestSubtreeUpdateVerifier__factory(deployer);
  } else {
    SubtreeUpdateVerifier = new SubtreeUpdateVerifier__factory(deployer);
  }
  const subtreeUpdateVerifier = await SubtreeUpdateVerifier.deploy();
  subtreeUpdateVerifier.deployed();
  console.log(
    'SubtreeUpdateVerifier deployed to:',
    subtreeUpdateVerifier.address,
  );

  // Deploy Wallet
  console.log('\nDeploying Wallet');
  const Wallet = new Wallet__factory(deployer);
  const walletProxy = await upgrades.deployProxy(Wallet, {
    initializer: false,
    kind: 'transparent',
  });
  await walletProxy.deployed();
  console.log('Wallet proxy deployed to:', walletProxy.address);

  const walletImplementationAddress =
    await upgrades.erc1967.getImplementationAddress(walletProxy.address);
  console.log(
    'Wallet implementation deployed to:',
    walletImplementationAddress,
  );

  const walletAdminAddress = await upgrades.erc1967.getAdminAddress(
    vaultProxy.address,
  );
  console.log('Wallet proxy admin currently set to:', walletAdminAddress);

  await upgrades.admin.changeProxyAdmin(
    walletProxy.address,
    proxyAdmin.address,
  );
  console.log('Wallet proxy admin changed to:', proxyAdmin.address);

  // Initialize Vault and Wallet
  console.log('\nInitializing Vault');
  await vaultProxy.initialize(walletProxy.address);

  console.log('Initializing Wallet');
  await walletProxy.initialize(
    vaultProxy.address,
    joinSplitVerifier.address,
    subtreeUpdateVerifier.address,
  );

  // Try transfer ownership of proxy admin
  const transferOwnershipTx = await proxyAdmin.transferOwnership(
    proxyAdminOwner,
  );
  transferOwnershipTx.wait(3);
  console.log('\nTransfered proxy admin ownership to:', proxyAdminOwner);

  return {
    network: {
      name,
      chainId,
    },
    startBlock,
    proxyAdminOwner,
    proxyAdmin: proxyAdmin.address,
    walletProxy: {
      proxyAddress: walletProxy.address,
      implementationAddress: walletImplementationAddress,
    },
    vaultProxy: {
      proxyAddress: vaultProxy.address,
      implementationAddress: vaultImplementationAddress,
    },
    joinSplitVerifierAddress: joinSplitVerifier.address,
    subtreeUpdateVerifierAddress: subtreeUpdateVerifier.address,
  };
}

*/
