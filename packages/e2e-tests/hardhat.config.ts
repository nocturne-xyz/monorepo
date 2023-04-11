/**
 * @type import('hardhat/config').HardhatUserConfig
 */
export default {
  solidity: "0.8.17",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
    },
  },
};
