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
};

export default config;
