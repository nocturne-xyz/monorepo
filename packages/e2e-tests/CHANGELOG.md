# Changelog

### Unreleased

- Move contract setup to hardhat deploy script method `setup` (allows us to deploy against local hh node)
- Modify tests tests to use `Wallet` which now internally uses `OffchainMerkleTree` as a lib
- Modify tests to use `OffchainMerkleTree` with dummy ZK tree updates
- Modify `WalletAndNocturneContext` to use local merkle prover and notes managers to sync state and generate proof for bundle
- Add `LocalMerkleProver` test suite to check syncing functionality
- Refactor single test case to `NocturneContext`
- Add initial test case to transfer 50 tokens from 100 token note from Alice to Bob
