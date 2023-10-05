# @nocturne-xyz/insertion-writer

## 0.4.0

### Minor Changes

- a6275d8a: - split `core` in half, creating a new `client` package that houses `NocturneClient` and everything around it
  - moved all "sync adapter" interfaces into `core`
  - moved all "sync adapter" implementations into data-source-specific packages `rpc-sync-adapters`, `subgraph-sync-adapters`, and `hasura-sync-adapters`

### Patch Changes

- Updated dependencies [22abab87]
- Updated dependencies [a6275d8a]
  - @nocturne-xyz/core@3.0.0
  - @nocturne-xyz/subgraph-sync-adapters@0.3.0
  - @nocturne-xyz/persistent-log@0.1.7
  - @nocturne-xyz/offchain-utils@0.1.17

## 0.3.1

### Patch Changes

- 8b3e1b2c: scan over flattened subgraph entities
- Updated dependencies [e2801b16]
- Updated dependencies [5d90ac8e]
- Updated dependencies [8b3e1b2c]
- Updated dependencies [f80bff6a]
- Updated dependencies [fbfadb23]
- Updated dependencies [5d90ac8e]
  - @nocturne-xyz/core@2.2.0
  - @nocturne-xyz/config@1.2.0
  - @nocturne-xyz/persistent-log@0.1.6
  - @nocturne-xyz/offchain-utils@0.1.16

## 0.3.0

### Minor Changes

- 07625550: add support for `finalityBlocks` sync option

### Patch Changes

- Updated dependencies [7c190c2c]
- Updated dependencies [07625550]
- Updated dependencies [07625550]
  - @nocturne-xyz/core@2.1.0
  - @nocturne-xyz/config@1.1.0
  - @nocturne-xyz/persistent-log@0.1.5
  - @nocturne-xyz/offchain-utils@0.1.15

## 0.2.3

### Patch Changes

- Updated dependencies [16dfb275]
- Updated dependencies [dcea2acb]
  - @nocturne-xyz/core@2.0.2
  - @nocturne-xyz/persistent-log@0.1.4
  - @nocturne-xyz/offchain-utils@0.1.14

## 0.2.2

### Patch Changes

- Updated dependencies [47a5f1e5]
- Updated dependencies [0ed9f872]
- Updated dependencies [46e47762]
- Updated dependencies [4d7147b6]
  - @nocturne-xyz/config@1.0.0
  - @nocturne-xyz/core@2.0.1
  - @nocturne-xyz/persistent-log@0.1.3
  - @nocturne-xyz/offchain-utils@0.1.13

## 0.2.1

### Patch Changes

- 942a4720: - replace TEI block number hack with an additional `--throttle-on-empty-ms` for avoiding subgraph spam after adapter catches up
- Updated dependencies [9fccc32f]
- Updated dependencies [543af0b0]
- Updated dependencies [543af0b0]
  - @nocturne-xyz/core@2.0.0
  - @nocturne-xyz/persistent-log@0.1.2
  - @nocturne-xyz/offchain-utils@0.1.12

## 0.2.0

### Minor Changes

- 3e84f1fa: "initial implementation"

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
- Updated dependencies [6998bb7c]
- Updated dependencies [35b0f76f]
- Updated dependencies [77c4063c]
- Updated dependencies [589e0230]
- Updated dependencies [3be7d366]
- Updated dependencies [9098e2c8]
- Updated dependencies [27cb1b5c]
- Updated dependencies [58b363a4]
- Updated dependencies [003e7082]
- Updated dependencies [77c4063c]
- Updated dependencies [58b363a4]
- Updated dependencies [f8046431]
  - @nocturne-xyz/core@1.0.0
  - @nocturne-xyz/config@0.4.0
  - @nocturne-xyz/persistent-log@0.1.1
  - @nocturne-xyz/offchain-utils@0.1.11
