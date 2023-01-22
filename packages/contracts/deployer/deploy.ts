import { NocturneDeployment, NocturneDeployOpts } from './types';
import { upgrades, ethers } from 'hardhat';
import * as dotenv from 'dotenv';
import { ProxyAdmin__factory } from '../src/factories/ProxyAdmin__factory';
import { Accountant__factory } from '../src/factories/Accountant__factory';
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

  const deployer = new ethers.Wallet(deployerKey, provider);

  // Maybe deploy proxy admin
  let proxyAdmin = opts?.proxyAdmin;
  if (!proxyAdmin) {
    console.log('\nDeploying ProxyAdmin');
    const ProxyAdmin = new ProxyAdmin__factory(deployer);
    proxyAdmin = await ProxyAdmin.deploy();
    console.log('ProxyAdmin deployed to:', proxyAdmin.address);
  }

  // Deploy Accountant
  console.log('\nDeploying Accountant');
  const Accountant = new Accountant__factory(deployer);
  const accountantProxy = await upgrades.deployProxy(Accountant, {
    initializer: false,
    kind: 'transparent',
  });
  await accountantProxy.deployed();
  console.log('Accountant proxy deployed to:', accountantProxy.address);

  const accountantImplementationAddress =
    await upgrades.erc1967.getImplementationAddress(accountantProxy.address);
  console.log(
    'Accountant implementation deployed to:',
    accountantImplementationAddress,
  );

  const accountantAdminAddress = await upgrades.erc1967.getAdminAddress(
    accountantProxy.address,
  );
  console.log(
    'Accountant proxy admin currently set to:',
    accountantAdminAddress,
  );

  await upgrades.admin.changeProxyAdmin(
    accountantProxy.address,
    proxyAdmin.address,
  );
  console.log('Accountant proxy admin changed to:', proxyAdmin.address);

  // Deploy JoinSplitVerifier
  console.log('\nDeploying JoinSplitVerifier');
  const JoinSplitVerifier = new JoinSplitVerifier__factory(deployer);
  const joinSplitVerifier = await JoinSplitVerifier.deploy();
  await joinSplitVerifier.deployed();
  console.log('JoinSplitVerifier deployed to:', joinSplitVerifier.address);

  // Deploy SubtreeUpdateVerifier
  console.log('\nDeploying SubtreeUpdateVerifier');
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
    accountantProxy.address,
  );
  console.log('Wallet proxy admin currently set to:', walletAdminAddress);

  await upgrades.admin.changeProxyAdmin(
    walletProxy.address,
    proxyAdmin.address,
  );
  console.log('Wallet proxy admin changed to:', proxyAdmin.address);

  // Initialize Accountant and Wallet
  console.log('\nInitializing Accountant');
  await accountantProxy.initialize(
    walletProxy.address,
    joinSplitVerifier.address,
    subtreeUpdateVerifier.address,
  );

  console.log('Initializing Wallet');
  await walletProxy.initialize(
    accountantProxy.address,
    joinSplitVerifier.address,
  );

  // Try transfer ownership of proxy admin
  const transferOwnershipTx = await proxyAdmin.transferOwnership(
    proxyAdminOwner,
  );
  transferOwnershipTx.wait(3);
  console.log('\nTransfered proxy admin ownership to:', proxyAdminOwner);

  return {
    proxyAdminOwner,
    proxyAdmin: proxyAdmin.address,
    walletProxy: {
      proxyAddress: walletProxy.address,
      implementationAddress: walletImplementationAddress,
    },
    accountantProxy: {
      proxyAddress: accountantProxy.address,
      implementationAddress: accountantImplementationAddress,
    },
    joinSplitVerifierAddress: joinSplitVerifier.address,
    subtreeUpdateVerifierAddress: subtreeUpdateVerifier.address,
  };
}
