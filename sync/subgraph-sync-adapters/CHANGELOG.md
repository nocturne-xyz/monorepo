# Changelog

## 0.6.0

### Minor Changes

- 19b7836c: add `latestCommitTei` to `EncryptedStateDiff` type emitted by `SdkSyncAdapters`

### Patch Changes

- Updated dependencies [19b7836c]
  - @nocturne-xyz/core@3.4.0

## 0.5.3

### Patch Changes

- Updated dependencies [8b9d9030]
  - @nocturne-xyz/core@3.3.0

## 0.5.2

### Patch Changes

- c8cfc54c: add `limit` parameter to fetchDepositEvents

## 0.5.1

### Patch Changes

- 87d5bb40: dummy bump
- Updated dependencies [87d5bb40]
  - @nocturne-xyz/core@3.2.1

## 0.5.0

### Minor Changes

- 3ca99eaf: add txhash and timestamp to deposit event

### Patch Changes

- Updated dependencies [3ca99eaf]
  - @nocturne-xyz/core@3.2.0

## 0.4.2

### Patch Changes

- empty bump
- Updated dependencies
  - @nocturne-xyz/core@3.1.4

## 0.4.1

### Patch Changes

- Updated dependencies [4070b154]
  - @nocturne-xyz/core@3.1.3

## 0.4.1-beta.0

### Patch Changes

- Updated dependencies [4070b154]
  - @nocturne-xyz/core@3.1.3-beta.0

## 0.3.4

### Patch Changes

- 1b2530d1: pass logger into make subgraph utils and log errors
- Updated dependencies [1b2530d1]
  - @nocturne-xyz/core@3.1.2

## 0.3.3

### Patch Changes

- ef178c21: reduce batch size to 50 when fetching deposit events
- Updated dependencies [45d0719a]
  - @nocturne-xyz/core@3.1.1

## 0.3.2

### Patch Changes

- a72e2077: fix unnecessary error when startMerkleIndex in middle of batch

## 0.3.1

### Patch Changes

- Updated dependencies [a94caaec]
- Updated dependencies [c717e4d9]
  - @nocturne-xyz/core@3.1.0

## 0.3.0

### Minor Changes

- a6275d8a: - split `core` in half, creating a new `client` package that houses `NocturneClient` and everything around it
  - moved all "sync adapter" interfaces into `core`
  - moved all "sync adapter" implementations into data-source-specific packages `rpc-sync-adapters`, `subgraph-sync-adapters`, and `hasura-sync-adapters`

### Patch Changes

- Updated dependencies [22abab87]
- Updated dependencies [a6275d8a]
  - @nocturne-xyz/core@3.0.0
