import "hardhat-gas-reporter";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-packager";
import "hardhat-preprocessor";
import * as fs from "fs";

import { subtask } from "hardhat/config";
import { TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS } from "hardhat/builtin-tasks/task-names";

import * as dotenv from "dotenv";
dotenv.config();

const infuraKey = process.env.INFURA_API_KEY;

subtask(TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS).setAction(
  async (_, __, runSuper) => {
    const paths: string[] = await runSuper();

    return paths.filter((p) => !p.endsWith(".t.sol") && !p.includes("test"));
  }
);

function getRemappings() {
  return fs
    .readFileSync("remappings.txt", "utf8")
    .split("\n")
    .filter(Boolean) // remove empty lines
    .map((line) => line.trim().split("="));
}

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: "0.8.4",
    settings: {
      optimizer: {
        enabled: true,
        runs: 999999,
      },
      metadata: {
        bytecodeHash: "none",
      },
    },
  },

  gasReporter: {
    currency: "USD",
  },

  networks: {
    localhost: {
      url: "http://localhost:8545",
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
    outDir: "./src",
    target: "ethers-v5",
    alwaysGenerateOverloads: false, // should overloads with full signatures like deposit(uint256) be generated always, even if there are no overloads?
  },

  // config for hardhat-packager
  // https://www.npmjs.com/package/hardhat-packager
  packager: {
    contracts: ["Wallet", "Vault"],
    includeFactories: true,
  },
  preprocess: {
    eachLine: (hre) => ({
      transform: (line: string) => {
        if (line.match(/^\s*import /i)) {
          for (const [from, to] of getRemappings()) {
            if (line.includes(from)) {
              line = line.replace(from, to);
              break;
            }
          }
        }
        return line;
      },
    }),
  },
  paths: {
    sources: "./contracts",
    cache: "./cache_hardhat",
  },
};
