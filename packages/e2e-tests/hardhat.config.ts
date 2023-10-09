/**
 * @type import('hardhat/config').HardhatUserConfig
 */
export default {
  solidity: "0.8.17",
  networks: {
    hardhat: {
      blockGasLimit: 100_000_000,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      blockGasLimit: 100_000_000,
    },
  },
};
