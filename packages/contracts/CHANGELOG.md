# Changelog

### Unreleased

- Add fixture unit test for `SubtreeUpdateVerifier`
- Update `DummyWallet` unit test to use `OffchainMerkleTree` instead
- Add unit test for `OffchainMerkleTree`
- Add `TreeTest` lib to test utils. Containins helpers for computing / maintaining subtree roots
- Add `TestSubtreeUpdateVerifier` to test utils
- Change `CommitmentTreeManager` to use `OffchainMerkleTree` instead of `BatchBinaryMerkle`
- Remove Poseidon from all contracts
- Split `LeavesInserted` event into `InsertNoteCommitment` and `InsertNote`
- Add `IOffChainMerkleTree` and `MerkleTree` for Offchain ZK updates
- Add `Utils` lib for encoding / hashing details
- Add `SubtreeUpdateVerifier` contract
- Fix events to have fields > 32 bytes be not `indexed`
- Add `Spend` event and emit on `handleSpend`
- Rename spend transaction `value` to `valueToSpend`
- Fix merkle index bug where `insert8` and `insert16` only incremented `numberOfLeaves` by 1
- Start test suite for `PoseidonBatchBinaryMerkle`
- Break up `BatchBinaryMerkle` lib into `BinaryMerkle` and `Queue`
- Add `Refund` events to `CommitmentTreeManager`
- Update `Spend2Verifier` to match simplified `FLAXAddress` + vk/sk scheme
- Rename `SpendTransaction.noteCommitment` to `newNoteCommitment` for clarity
- Add tests for verifier contract
- Make commitment tree and hash functions generic behind interfaces
- Add contracts as package in yarn workspace