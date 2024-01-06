# Changelog

## 0.6.5-alpha.0

### Patch Changes

- Updated dependencies [19b7836c]
  - @nocturne-xyz/core@3.4.0-alpha.0

## 0.6.4

### Patch Changes

- Updated dependencies [8b9d9030]
  - @nocturne-xyz/core@3.3.0

## 0.6.3

### Patch Changes

- 87d5bb40: dummy bump
- Updated dependencies [87d5bb40]
  - @nocturne-xyz/core@3.2.1
  - @nocturne-xyz/crypto@0.4.2

## 0.6.2

### Patch Changes

- Updated dependencies [3ca99eaf]
  - @nocturne-xyz/core@3.2.0

## 0.6.1

### Patch Changes

- empty bump
- Updated dependencies
  - @nocturne-xyz/crypto@0.4.1
  - @nocturne-xyz/core@3.1.4

## 0.6.0

### Minor Changes

- 8973d4cb: use typed snarkjs

### Patch Changes

- Updated dependencies [8973d4cb]
- Updated dependencies [4070b154]
  - @nocturne-xyz/crypto@0.4.0
  - @nocturne-xyz/core@3.1.3

## 0.6.0-beta.0

### Minor Changes

- 8973d4cb: use typed snarkjs

### Patch Changes

- Updated dependencies [8973d4cb]
- Updated dependencies [4070b154]
  - @nocturne-xyz/crypto@0.4.0-beta.0
  - @nocturne-xyz/core@3.1.3-beta.0

## 0.5.0

### Minor Changes

- 18f6e56c: update circuit artifacts

### Patch Changes

- Updated dependencies [1b2530d1]
  - @nocturne-xyz/core@3.1.2

## 0.4.8

### Patch Changes

- Updated dependencies [45d0719a]
  - @nocturne-xyz/core@3.1.1

## 0.4.7

### Patch Changes

- Updated dependencies [a94caaec]
- Updated dependencies [c717e4d9]
  - @nocturne-xyz/core@3.1.0

## 0.4.6

### Patch Changes

- Updated dependencies [22abab87]
- Updated dependencies [a6275d8a]
  - @nocturne-xyz/core@3.0.0

## 0.4.5

### Patch Changes

- Updated dependencies [e2801b16]
- Updated dependencies [5d90ac8e]
- Updated dependencies [8b3e1b2c]
- Updated dependencies [f80bff6a]
- Updated dependencies [fbfadb23]
- Updated dependencies [10b5bda4]
  - @nocturne-xyz/core@2.2.0
  - @nocturne-xyz/crypto@0.3.0

## 0.4.4

### Patch Changes

- 7c190c2c: use `crypto` instead of `crypto-utils`
- Updated dependencies [7c190c2c]
- Updated dependencies [07625550]
- Updated dependencies [d1c549a4]
  - @nocturne-xyz/core@2.1.0
  - @nocturne-xyz/crypto@0.2.0

## 0.4.3

### Patch Changes

- Updated dependencies [16dfb275]
- Updated dependencies [dcea2acb]
  - @nocturne-xyz/core@2.0.2

## 0.4.2

### Patch Changes

- Updated dependencies [0ed9f872]
- Updated dependencies [4d7147b6]
  - @nocturne-xyz/core@2.0.1

## 0.4.1

### Patch Changes

- Updated dependencies [9fccc32f]
- Updated dependencies [543af0b0]
- Updated dependencies [543af0b0]
  - @nocturne-xyz/core@2.0.0

## 0.4.0

### Minor Changes

- 77c4063c: `CanonAddrSigCheck` circuit takes msg directly as PI instead of computing it from nonce
- 589e0230: add sdk support for generating CanonAddrSigCheck proofs

### Patch Changes

- Updated dependencies [6abd69b9]
- Updated dependencies [81598815]
- Updated dependencies [003e7082]
- Updated dependencies [1ffcf31f]
- Updated dependencies [fc364ae8]
- Updated dependencies [0cb20e3d]
- Updated dependencies [86d484ad]
- Updated dependencies [1ffcf31f]
- Updated dependencies [77c4063c]
- Updated dependencies [58b363a4]
- Updated dependencies [35b0f76f]
- Updated dependencies [589e0230]
- Updated dependencies [3be7d366]
- Updated dependencies [9098e2c8]
- Updated dependencies [58b363a4]
- Updated dependencies [003e7082]
- Updated dependencies [77c4063c]
- Updated dependencies [58b363a4]
- Updated dependencies [f8046431]
  - @nocturne-xyz/core@1.0.0
  - @nocturne-xyz/crypto-utils@0.3.1

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
