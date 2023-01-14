# Changelog

### Unreleased

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
