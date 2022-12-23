import "solhint";
import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
import { HardhatUserConfig } from "hardhat/config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.5",
    settings: {
      optimizer: { enabled: true, runs: 999999 },
    },
  },
  namedAccounts: {
    owner: 0,
    user: 1,
  },
  mocha: {
    timeout: 1_000_000, // 1M ms --> 1000 sec
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
    localhost: {
      url: "http://localhost:8545",
      saveDeployments: false,
    },
  },
};

export default config;
