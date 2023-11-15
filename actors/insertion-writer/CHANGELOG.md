# @nocturne-xyz/insertion-writer

## 0.5.8

### Patch Changes

- Updated dependencies [3ca99eaf]
  - @nocturne-xyz/subgraph-sync-adapters@0.5.0
  - @nocturne-xyz/core@3.2.0
  - @nocturne-xyz/persistent-log@0.1.13
  - @nocturne-xyz/offchain-utils@0.5.1

## 0.5.7

### Patch Changes

- Updated dependencies [fd8709ed]
- Updated dependencies [c34c6b7a]
  - @nocturne-xyz/offchain-utils@0.5.0
  - @nocturne-xyz/config@1.7.2

## 0.5.6

### Patch Changes

- empty bump
- Updated dependencies
  - @nocturne-xyz/subgraph-sync-adapters@0.4.2
  - @nocturne-xyz/offchain-utils@0.4.1
  - @nocturne-xyz/persistent-log@0.1.12
  - @nocturne-xyz/config@1.7.1
  - @nocturne-xyz/core@3.1.4

## 0.5.5

### Patch Changes

- Updated dependencies [1d5cefc2]
- Updated dependencies [fdefa43b]
- Updated dependencies [4070b154]
  - @nocturne-xyz/config@1.7.0
  - @nocturne-xyz/offchain-utils@0.4.0
  - @nocturne-xyz/core@3.1.3
  - @nocturne-xyz/persistent-log@0.1.11
  - @nocturne-xyz/subgraph-sync-adapters@0.4.1

## 0.5.5-beta.0

### Patch Changes

- Updated dependencies
- Updated dependencies [fdefa43b]
- Updated dependencies [4070b154]
  - @nocturne-xyz/config@1.7.0-beta.0
  - @nocturne-xyz/offchain-utils@0.4.0-beta.0
  - @nocturne-xyz/core@3.1.3-beta.0
  - @nocturne-xyz/persistent-log@0.1.11-beta.0
  - @nocturne-xyz/subgraph-sync-adapters@0.4.1-beta.0

## 0.5.4

### Patch Changes

- Updated dependencies [8742f9a0]
  - @nocturne-xyz/config@1.6.0

## 0.5.3

### Patch Changes

- Updated dependencies [1b2530d1]
  - @nocturne-xyz/subgraph-sync-adapters@0.3.4
  - @nocturne-xyz/core@3.1.2
  - @nocturne-xyz/persistent-log@0.1.10
  - @nocturne-xyz/offchain-utils@0.3.2

## 0.5.2

### Patch Changes

- Updated dependencies [ef178c21]
- Updated dependencies [b2938fc0]
- Updated dependencies [45d0719a]
  - @nocturne-xyz/subgraph-sync-adapters@0.3.3
  - @nocturne-xyz/config@1.5.0
  - @nocturne-xyz/core@3.1.1
  - @nocturne-xyz/persistent-log@0.1.9
  - @nocturne-xyz/offchain-utils@0.3.1

## 0.5.1

### Patch Changes

- Updated dependencies [fc7fa6c4]
  - @nocturne-xyz/config@1.4.0

## 0.5.0

### Minor Changes

- 724869eb: - update CLIs to reflect new logger semantics
  - replace all console logs with logger invocations

### Patch Changes

- 891de7e5: Change log level flag to just --log-level
- b3f201f1: fix bug in metadata formatting for empty insertion batches
- Updated dependencies [724869eb]
- Updated dependencies [891de7e5]
  - @nocturne-xyz/offchain-utils@0.3.0

## 0.4.3

### Patch Changes

- Updated dependencies [26c43e44]
- Updated dependencies [2c465f4e]
- Updated dependencies [717ebcba]
- Updated dependencies [a72e2077]
  - @nocturne-xyz/offchain-utils@0.2.0
  - @nocturne-xyz/subgraph-sync-adapters@0.3.2

## 0.4.2

### Patch Changes

- Updated dependencies [abfab3f2]
  - @nocturne-xyz/config@1.3.1

## 0.4.1

### Patch Changes

- Updated dependencies [d89a77e4]
- Updated dependencies [a94caaec]
- Updated dependencies [c717e4d9]
  - @nocturne-xyz/config@1.3.0
  - @nocturne-xyz/core@3.1.0
  - @nocturne-xyz/persistent-log@0.1.8
  - @nocturne-xyz/subgraph-sync-adapters@0.3.1
  - @nocturne-xyz/offchain-utils@0.1.18

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
