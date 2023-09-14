# Changelog

## 0.3.1

### Patch Changes

- 86d484ad: - implement plugin system for `OperationRequestBuilder` and update APIs accordingly
- 003e7082: replace manual op request building with erc20 plugin usage
- Updated dependencies [6abd69b9]
- Updated dependencies [81598815]
- Updated dependencies [003e7082]
- Updated dependencies [1ffcf31f]
- Updated dependencies [fc364ae8]
- Updated dependencies [003e7082]
- Updated dependencies [0cb20e3d]
- Updated dependencies [6abd69b9]
- Updated dependencies [86d484ad]
- Updated dependencies [589e0230]
- Updated dependencies [6998bb7c]
- Updated dependencies [1ffcf31f]
- Updated dependencies [77c4063c]
- Updated dependencies [6998bb7c]
- Updated dependencies [77c4063c]
- Updated dependencies [0cb20e3d]
- Updated dependencies [35b0f76f]
- Updated dependencies [77c4063c]
- Updated dependencies [589e0230]
- Updated dependencies [9098e2c8]
- Updated dependencies [3be7d366]
- Updated dependencies [9098e2c8]
- Updated dependencies [de88d6f0]
- Updated dependencies [58b363a4]
- Updated dependencies [003e7082]
- Updated dependencies [77c4063c]
- Updated dependencies [58b363a4]
- Updated dependencies [f8046431]
  - @nocturne-xyz/core@1.0.0
  - @nocturne-xyz/contracts@0.4.0
  - @nocturne-xyz/op-request-plugins@0.2.0
  - @nocturne-xyz/config@0.4.0
  - @nocturne-xyz/local-prover@0.4.0
  - @nocturne-xyz/offchain-utils@0.1.11

## 0.3.0

### Minor Changes

- fix publish command

### Patch Changes

- Updated dependencies
  - @nocturne-xyz/local-prover@0.3.0
  - @nocturne-xyz/contracts@0.3.0
  - @nocturne-xyz/config@0.3.0
  - @nocturne-xyz/core@0.3.0

## 0.2.0

### Minor Changes

- 6c0a5d7c: overhaul monorepo structure & start proper versioning system

### Patch Changes

- Updated dependencies [6c0a5d7c]
  - @nocturne-xyz/local-prover@0.2.0
  - @nocturne-xyz/contracts@0.2.0
  - @nocturne-xyz/config@0.2.0
  - @nocturne-xyz/core@0.1.4

### Unreleased

- replace tx manager with OZ relay
- use .network instead of .chainid for op request building
- add CLI option to perform 8 ops in rapid succession to fill a bundle every K ops
- allow setting separate intervals for deposits and ops in CLI
- run deposits and ops concurrently
- test actor uses lmdb kv and loads merkle from kv
- add lmdb implementation for kv store + unit tests forked from sdk unit tests
- limit test actor unwrap amount to < 2 ETH
- overshoot op gas by 20% to avoid failures due to gas price fluctuation
- add CLI options for only deposit/operations and interval time between actions
- apply optimistic NFs after preparing ops (allows submitting multiple ops for batches)
- actor draws on test erc20s and mints/deposits
