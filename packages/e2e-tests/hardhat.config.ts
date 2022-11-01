import "solhint";
import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
import { HardhatUserConfig } from "hardhat/config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.2",
    settings: {
      optimizer: { enabled: true, runs: 999999 },
    },
  },
  namedAccounts: {
    owner: 0,
    user: 1,
  },
  mocha: {
    timeout: 100_000, // 100k ms --> 100 sec
  },
  networks: {
    localhost: {
      live: false,
      saveDeployments: false,
      tags: ["local"],
    },
  },
};

export default config;
