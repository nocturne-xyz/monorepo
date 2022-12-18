import 'hardhat-gas-reporter';
import '@nomiclabs/hardhat-etherscan';
import 'hardhat-packager';

import { subtask } from 'hardhat/config';
import { TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS } from 'hardhat/builtin-tasks/task-names';

import * as dotenv from 'dotenv';
dotenv.config();

const infuraKey = process.env.INFURA_API_KEY;

subtask(TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS).setAction(
  async (_, __, runSuper) => {
    const paths: string[] = await runSuper();

    return paths.filter(
      (p) =>
        (!p.endsWith('.t.sol') && !p.includes('test')) ||
        p.includes('TestSubtreeUpdateVerifier'),
    );
  },
);

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: '0.8.17',
    settings: {
      optimizer: {
        enabled: true,
        runs: 999999,
      },
      metadata: {
        bytecodeHash: 'none',
      },
    },
  },

  gasReporter: {
    currency: 'USD',
  },

  networks: {
    localhost: {
      url: 'http://localhost:8545',
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${infuraKey}`,
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${infuraKey}`,
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${infuraKey}`,
    },
  },

  typechain: {
    outDir: './src',
    target: 'ethers-v5',
    alwaysGenerateOverloads: false, // should overloads with full signatures like deposit(uint256) be generated always, even if there are no overloads?
  },

  // config for hardhat-packager
  // https://www.npmjs.com/package/hardhat-packager
  packager: {
    contracts: [
      'IERC20',
      'IERC721',
      'IERC1155',
      'IHasherT3',
      'IHasherT4',
      'IHasherT5',
      'IHasherT6',
      'IHasherT7',
      'IPoseidonT3',
      'IPoseidonT4',
      'IPoseidonT5',
      'IPoseidonT6',
      'IPoseidonT7',
      'IJoinSplitVerifier',
      'ISubtreeUpdateVerifier',
      'IVault',
      'IWallet',
      // TODO: deduplicate these in an automated way somehow
      'PoseidonHasherT3',
      'PoseidonHasherT4',
      'PoseidonHasherT5',
      'PoseidonHasherT6',
      'PoseidonHasherT7',
      'Wallet',
      'Vault',
      'CommitmentTreeManager',
      'BalanceManager',
      'JoinSplitVerifier',
      'SubtreeUpdateVerifier',
      'SimpleERC20Token',
      'SimpleERC721Token',
      'SimpleERC1155Token',
      'TestSubtreeUpdateVerifier',
    ],
    includeFactories: true,
  },
  paths: {
    sources: './contracts',
    cache: './cache_hardhat',
  },
};
