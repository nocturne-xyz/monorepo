# Changelog

### Unreleased

- Modify `WalletAndFlaxContext` to use local merkle prover and notes managers to sync state and generate proof for bundle
- Add `LocalMerkleProver` test suite to check syncing functionality
- Refactor single test case to `FlaxContext`
- Add initial test case to transfer 50 tokens from 100 token note from Alice to Bob
- Update tests to use `OffchainMerkleTree` with dummy ZK tree updates