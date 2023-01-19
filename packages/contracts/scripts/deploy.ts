import {
  JoinSplitVerifier__factory,
  SubtreeUpdateVerifier__factory,
  Vault__factory,
  Wallet__factory,
} from '@nocturne-xyz/contracts';
import { ethers, upgrades } from 'hardhat';
import * as dotenv from 'dotenv';

dotenv.config();

export interface ProxiedContract {
  proxyAddress: string;
  implementationAddress: string;
}

export interface NocturneDeployment {
  proxyAdminAddress: string;
  walletProxy: ProxiedContract;
  vaultProxy: ProxiedContract;
  joinSplitVerifierAddress: string;
  subtreeUpdateVerifierAddress: string;
}

export async function deployNocturne(
  proxyAdminAddress: string,
  provider?: ethers.providers.Provider,
): Promise<NocturneDeployment> {
  const deployerKey = process.env.DEPLOYER_KEY;
  if (!deployerKey) throw new Error('Deploy script missing deployer key');

  if (!provider) {
    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) throw new Error('Deploy script missing rpc url');
    provider = ethers.providers.getDefaultProvider(rpcUrl);
  }

  const deployer = new ethers.Wallet(deployerKey, provider);

  // Deploy Vault
  const Vault = new Vault__factory(deployer);
  const vaultProxy = await upgrades.deployProxy(Vault, {
    initializer: false,
    kind: 'transparent',
  });
  await vaultProxy.deployed();
  console.log('Vault proxy deployed to:', vaultProxy.address);

  const vaultImplementationAddress =
    await upgrades.erc1967.getImplementationAddress(vaultProxy.address);
  console.log('Wallet implementation deployed to:', vaultImplementationAddress);

  await upgrades.admin.changeProxyAdmin(vaultProxy.address, proxyAdminAddress);
  console.log('Vault proxy admin changed to:', proxyAdminAddress);

  // Deploy JoinSplitVerifier
  const JoinSplitVerifier = new JoinSplitVerifier__factory(deployer);
  const joinSplitVerifier = await JoinSplitVerifier.deploy();
  await joinSplitVerifier.deployed();
  console.log('JoinSplitVerifier deployed to:', joinSplitVerifier.address);

  // Deploy SubtreeUpdateVerifier
  const SubtreeUpdateVerifier = new SubtreeUpdateVerifier__factory(deployer);
  const subtreeUpdateVerifier = await SubtreeUpdateVerifier.deploy();
  await subtreeUpdateVerifier.deployed();
  console.log(
    'SubtreeUpdateVerifier deployed to:',
    subtreeUpdateVerifier.address,
  );

  // Deploy Wallet
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

  await upgrades.admin.changeProxyAdmin(walletProxy.address, proxyAdminAddress);
  console.log('Wallet proxy admin changed to:', proxyAdminAddress);

  // Initialize Vault and Wallet
  await vaultProxy.initialize(walletProxy.address);
  await walletProxy.initialize(
    vaultProxy.address,
    joinSplitVerifier.address,
    subtreeUpdateVerifier.address,
  );

  return {
    proxyAdminAddress,
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

(async () => {
  const proxyAdminAddress = process.env.PROXY_ADMIN_ADDRESS;
  if (!proxyAdminAddress)
    throw new Error('Deploy script missing proxy admin address');

  const deployment = await deployNocturne(proxyAdminAddress);
  console.log(deployment);
})();
