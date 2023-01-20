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
  proxyAdminOwner: string,
  opts?: NocturneDeployOpts,
): Promise<NocturneDeployment> {
  const deployerKey = process.env.DEPLOYER_KEY;
  if (!deployerKey) throw new Error('Deploy script missing deployer key');

  let provider = opts?.provider;
  if (!provider) {
    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) throw new Error('Deploy script missing rpc url');
    provider = ethers.providers.getDefaultProvider(rpcUrl);
  }

  const deployer = new ethers.Wallet(deployerKey, provider);

  // Maybe deploy proxy admin
  let proxyAdmin = opts?.proxyAdmin;
  if (!proxyAdmin) {
    const ProxyAdmin = new ProxyAdmin__factory(deployer);
    proxyAdmin = await ProxyAdmin.deploy();
  }

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

  await upgrades.admin.changeProxyAdmin(vaultProxy.address, proxyAdmin.address);
  console.log('Vault proxy admin changed to:', proxyAdmin.address);

  // Deploy JoinSplitVerifier
  const JoinSplitVerifier = new JoinSplitVerifier__factory(deployer);
  const joinSplitVerifier = await JoinSplitVerifier.deploy();
  await joinSplitVerifier.deployed();
  console.log('JoinSplitVerifier deployed to:', joinSplitVerifier.address);

  // Deploy SubtreeUpdateVerifier
  let SubtreeUpdateVerifier;
  if (opts?.mockSubtreeUpdateVerifier) {
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

  await upgrades.admin.changeProxyAdmin(
    walletProxy.address,
    proxyAdmin.address,
  );
  console.log('Wallet proxy admin changed to:', proxyAdmin.address);

  // Initialize Vault and Wallet
  await vaultProxy.initialize(walletProxy.address);
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
  console.log('Transfered proxy admin ownership to:', proxyAdminOwner);

  return {
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

(async () => {
  const proxyAdminOwner = process.env.PROXY_ADMIN_OWNER;
  if (!proxyAdminOwner)
    throw new Error('Deploy script missing proxy admin owner address');

  const deployment = await deployNocturne(proxyAdminOwner);
  console.log(deployment);
  process.exit(0);
})();
