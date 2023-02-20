# Changelog

### Unreleased

- Container names use uuid for randomness to avoid conflicts in CI
- Have `hh-node` and `hh-node-deposit` commands use dockerized hardhat
- Change deposit script token deployment to be sequential (nonce conflicts)
- Replace in memory instantiation of hardhat, subtree updater, and bundler with dockerized versions in test cases
- Add `src` to include functions previously in `utils` + actor instantiation functions (ones that use dockerode or docker-compose)
- Remove `utils` folder
- Add `hardhat` sub-package
- use `OperationRequestBuilder` for e2e tests
- update imports for new `AssetTrait`
- update imports with SDK renames (see SDK changelog)
- Replace custom hardhat deploy scripts with deploy package deploy script
- Deposit script funds with proper decimal-based amount using parseEther
- Deposit funds script sends ETH to test eth addrs
- Fill batch with zeros in deposit script
- Fix setup script regression post-upgrades, we only deploy contracts in setup script in e2e-tests, not hh-node
- Slightly modify deployNocturne script to deploy proxies without properly managing proxy admin (temporary, to be replaced by proper deploy script later)
- Deposit script creates and sends funds for two tokens
- Modify deposit script to airdrop tokens to hardcoded nocturne addresses
- Fix `localhost` hardhat network to match `hardhat node`, which hosts at `127.0.0.1` instead of `localhost`
- Break erc20 from erc721/1155 tests and use test runner pattern
- Add ERC721 and ERC1155 minting to `FullEndToEnd` test suite
- Add bundler to full e2e test, rename file from `WalletAndContext` to `FullEndToEnd`
- Change e2e-test to test erc20.trasfer, refund, and confidential payments
- Add check for `OperationProcessed` event
- Add e2e-test for standalone `SubtreeUpdateServer`
- Modify e2e-test to use `SubtreeUpdater`
- Modified e2e-test to use joinsplit
- Rename all "flax" instances to "nocturne"
- Change package version to `-alpha`
- Move contract setup to hardhat deploy script method `setup` (allows us to deploy against local hh node)
- Modify tests tests to use `Wallet` which now internally uses `OffchainMerkleTree` as a lib
- Modify tests to use `OffchainMerkleTree` with dummy ZK tree updates
- Modify `WalletAndNocturneContext` to use local merkle prover and notes managers to sync state and generate proof for bundle
- Add `LocalMerkleProver` test suite to check syncing functionality
- Refactor single test case to `NocturneContext`
- Add initial test case to transfer 50 tokens from 100 token note from Alice to Bob
