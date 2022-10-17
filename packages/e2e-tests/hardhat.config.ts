import "solhint";
import "@nomiclabs/hardhat-ethers";
import { HardhatUserConfig } from "hardhat/config";
import "hardhat-deploy";
import "hardhat-tracer";
import * as path from "path";

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
