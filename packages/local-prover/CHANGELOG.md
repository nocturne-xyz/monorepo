# Changelog

## 0.3.0

### Minor Changes

- fix publish command

### Patch Changes

- Updated dependencies
  - @nocturne-xyz/crypto-utils@0.3.0
  - @nocturne-xyz/core@0.3.0

## 0.2.0

### Minor Changes

- 6c0a5d7c: overhaul monorepo structure & start proper versioning system

### Patch Changes

- Updated dependencies [6c0a5d7c]
  - @nocturne-xyz/crypto-utils@0.2.0
  - @nocturne-xyz/core@0.1.4

### Unreleased

- update `JoinSplitInputs` type with zero'd out `encodedAsset` PIs
- update `JoinSplitInputs` type with `refundAddr` and `senderCommitment` instead of `encSenderCanoAddr` and `encRandomness`
- coerce `publicSignals` to `bigint[]`
- in `genSubtreeUpdateTestCase`, get zero value, depth, and arity from `TreeConstants`
- update fixture scripts
- `genJoinSplitTestCase` prints out proving time
- add `encRandomness` to `genJoinSplitTestCase`
- add `encSenderCanonAddrC1X`, `encSenderCanonAddrC2X` to public signals
- add `encRandomness` to inputs
- clean up module hierarchy, remove unnecessary exports, and make exports explicit
- use `poseidonBN` from `@nocturne-xyz/crypto-utils`
- Rename
  - `LocalJoinSplitProver` -> `WasmJoinSplitProver`
  - `LocalSubtreeUpdateProver` -> `WasmSubtreeUpdateProver`
- use `OperationStatus` from `@nocturne-xyz/sdk`
- move `subtreeUpdateInputsFromBatch` to `sdk`
- Remove `toJSON` and all `fromJSON` methods in favor of custom `bigint-json-serialization`
- Add local prover for subtree update
- Refactor joinsplit prover to take circuit files as class fields not function args
- Rename all "flax" instances to "nocturne"
- Change package version to `-alpha`
- Add local `joinsplit` implementation and port over SDK gen test case scripts
- Add local prover package with local `spend2` prover implementation
