# Changelog

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
