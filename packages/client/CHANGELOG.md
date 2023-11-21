# Changelog

## 3.4.2

### Patch Changes

- 9e63e754: log instead of throw on missing op history record
- 326fd2b2: add typed error for when user doesn't have enough funds for op request

## 3.4.1

### Patch Changes

- 87d5bb40: dummy bump
- Updated dependencies [87d5bb40]
  - @nocturne-xyz/config@1.7.3
  - @nocturne-xyz/core@3.2.1
  - @nocturne-xyz/crypto@0.4.2

## 3.4.0

### Minor Changes

- 35875d78: throw typed `NotEnoughGasTokens` error when `opRequestGas` fails due to not enough gas tokens

## 3.3.0

### Minor Changes

- 21d65e2b: throw typed `NotEnoughGasTokens` error when `opRequestGas` fails due to not enough gas tokens

### Patch Changes

- f92a1cfe: fix edge case where estimate in error msg is wrong

## 3.2.1

### Patch Changes

- Updated dependencies [3ca99eaf]
  - @nocturne-xyz/core@3.2.0

## 3.2.0

### Minor Changes

- 9b17bc41: add method to get current tree root

### Patch Changes

- feb897cf: pass in actual gas estimate into snap
- Updated dependencies [c34c6b7a]
  - @nocturne-xyz/config@1.7.2

## 3.1.4

### Patch Changes

- empty bump
- Updated dependencies
  - @nocturne-xyz/config@1.7.1
  - @nocturne-xyz/crypto@0.4.1
  - @nocturne-xyz/core@3.1.4

## 3.1.3

### Patch Changes

- 41671325: ensure frontend-sdk syncs when latestCommittedIndex != latestSyncedIndex
- 79aa7a82: Lower gas estimation numbers to match contracts (100k gas buffer not 300k)
- Updated dependencies [1d5cefc2]
- Updated dependencies [8973d4cb]
- Updated dependencies [4070b154]
  - @nocturne-xyz/config@1.7.0
  - @nocturne-xyz/crypto@0.4.0
  - @nocturne-xyz/core@3.1.3

## 3.1.3-beta.0

### Patch Changes

- 41671325: ensure frontend-sdk syncs when latestCommittedIndex != latestSyncedIndex
- 79aa7a82: Lower gas estimation numbers to match contracts (100k gas buffer not 300k)
- Updated dependencies
- Updated dependencies [8973d4cb]
- Updated dependencies [4070b154]
  - @nocturne-xyz/config@1.7.0-beta.0
  - @nocturne-xyz/crypto@0.4.0-beta.0
  - @nocturne-xyz/core@3.1.3-beta.0

## 3.1.2

### Patch Changes

- Updated dependencies [8742f9a0]
  - @nocturne-xyz/config@1.6.0

## 3.1.1

### Patch Changes

- 3b9cf081: Adds extra metadata for Uniswap V3 Swap ops
- Updated dependencies [1b2530d1]
  - @nocturne-xyz/core@3.1.2

## 3.1.0

### Minor Changes

- 67b9116a: setSpendKey passes along eoa address, checks for spend key exists calls nocturne_requestSpendKeyEoa instead
- 23243741: (BREAKING) get rid of `optimsiticOpDigest` stuff and replace with OpHistory
- b56ead58: add `OpHistoryStore`

### Patch Changes

- 85811df6: export `GetNotesOpts`
- Updated dependencies [b2938fc0]
- Updated dependencies [45d0719a]
  - @nocturne-xyz/config@1.5.0
  - @nocturne-xyz/core@3.1.1

## 3.0.5

### Patch Changes

- Updated dependencies [fc7fa6c4]
  - @nocturne-xyz/config@1.4.0

## 3.0.4

### Patch Changes

- 317a0708: fix snap keygen conversions

## 3.0.3

### Patch Changes

- 6fddaaa2: prepareOperation does not use spread syntax to avoid adding extra fields to PreSignOperation
- b49fd71f: Update ActionMetadata types to be consistent

## 3.0.2

### Patch Changes

- Updated dependencies [abfab3f2]
  - @nocturne-xyz/config@1.3.1

## 3.0.1

### Patch Changes

- Updated dependencies [c717e4d9]
- Updated dependencies [d89a77e4]
- Updated dependencies [a94caaec]
- Updated dependencies [c717e4d9]
  - @nocturne-xyz/contracts@1.2.0
  - @nocturne-xyz/config@1.3.0
  - @nocturne-xyz/core@3.1.0

## 3.0.0

### Major Changes

- a6275d8a: - split `core` in half, creating a new `client` package that houses `NocturneClient` and everything around it
  - moved all "sync adapter" interfaces into `core`
  - moved all "sync adapter" implementations into data-source-specific packages `rpc-sync-adapters`, `subgraph-sync-adapters`, and `hasura-sync-adapters`

### Patch Changes

- Updated dependencies [22abab87]
- Updated dependencies [a6275d8a]
- Updated dependencies [6ec2a7ac]
  - @nocturne-xyz/core@3.0.0
  - @nocturne-xyz/contracts@1.1.1
