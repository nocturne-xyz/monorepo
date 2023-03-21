import "@nomiclabs/hardhat-ethers";
import { task } from "hardhat/config";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const accounts = [
  "0000000000000000000000000000000000000000000000000000000000000001",
  "0000000000000000000000000000000000000000000000000000000000000002",
  "0000000000000000000000000000000000000000000000000000000000000003",
  "0000000000000000000000000000000000000000000000000000000000000004",
  "0000000000000000000000000000000000000000000000000000000000000005",
  "0000000000000000000000000000000000000000000000000000000000000006",
].map((privateKey) => ({
  privateKey,
  balance: String(10 ** 20), // 100 ETH
}));

let blockTime = 3_000;
if (process.env.BLOCK_TIME) {
  try {
    blockTime = parseInt(process.env.BLOCK_TIME);
  } catch (_) {}
}

console.log(
  `Staring with accounts:`,
  accounts.map((a) => a.privateKey)
);

// If a mainnet fork, then replace hardhat configurations with the following.
let hardhat: any;
if (process.env.ALCHEMY_FORK_URL) {
  hardhat = {
    mining: {
      auto: false,
      interval: blockTime,
    },
    accounts,
    forking: {
      url: `${process.env.ALCHEMY_FORK_URL}`,
      blockNumber: parseInt(process.env.BLOCK_NUMBER!),
    },
  };
} else {
  hardhat = {
    mining: {
      auto: false,
      interval: blockTime,
    },
    accounts,
  };
}

module.exports = {
  solidity: "0.8.17",
  defaultNetwork: "hardhat",
  networks: {
    hardhat,
  },
};
