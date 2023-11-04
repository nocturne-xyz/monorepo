# Changelog

## 0.6.2

### Patch Changes

- Updated dependencies [ef178c21]
- Updated dependencies [85811df6]
- Updated dependencies [b2938fc0]
- Updated dependencies [67b9116a]
- Updated dependencies [23243741]
- Updated dependencies [b56ead58]
- Updated dependencies [45d0719a]
  - @nocturne-xyz/subgraph-sync-adapters@0.3.3
  - @nocturne-xyz/client@3.1.0
  - @nocturne-xyz/config@1.5.0
  - @nocturne-xyz/core@3.1.1
  - @nocturne-xyz/op-request-plugins@2.1.2
  - @nocturne-xyz/local-prover@0.4.8
  - @nocturne-xyz/offchain-utils@0.3.1

## 0.6.1

### Patch Changes

- Updated dependencies [fc7fa6c4]
  - @nocturne-xyz/config@1.4.0
  - @nocturne-xyz/client@3.0.5
  - @nocturne-xyz/op-request-plugins@2.1.1

## 0.6.0

### Minor Changes

- 724869eb: - update CLIs to reflect new logger semantics
  - replace all console logs with logger invocations

### Patch Changes

- 2aac7894: deposit() uses try/catch so deposit loop will simply log errors and continue
- e82ab264: Stop waiting tx confirmation in deposit loop, error handling makes this fine
- 891de7e5: Change log level flag to just --log-level
- Updated dependencies [724869eb]
- Updated dependencies [891de7e5]
- Updated dependencies [caf815d8]
- Updated dependencies [e7dee7e1]
- Updated dependencies [317a0708]
  - @nocturne-xyz/offchain-utils@0.3.0
  - @nocturne-xyz/op-request-plugins@2.1.0
  - @nocturne-xyz/client@3.0.4

## 0.5.3

### Patch Changes

- Updated dependencies [26c43e44]
- Updated dependencies [2c465f4e]
- Updated dependencies [717ebcba]
- Updated dependencies [6fddaaa2]
- Updated dependencies [b49fd71f]
- Updated dependencies [a72e2077]
  - @nocturne-xyz/offchain-utils@0.2.0
  - @nocturne-xyz/client@3.0.3
  - @nocturne-xyz/op-request-plugins@2.0.3
  - @nocturne-xyz/subgraph-sync-adapters@0.3.2

## 0.5.2

### Patch Changes

- Updated dependencies [abfab3f2]
  - @nocturne-xyz/config@1.3.1
  - @nocturne-xyz/client@3.0.2
  - @nocturne-xyz/op-request-plugins@2.0.2

## 0.5.1

### Patch Changes

- Updated dependencies [c717e4d9]
- Updated dependencies [d89a77e4]
- Updated dependencies [4a8bb5eb]
- Updated dependencies [a94caaec]
- Updated dependencies [c717e4d9]
  - @nocturne-xyz/contracts@1.2.0
  - @nocturne-xyz/config@1.3.0
  - @nocturne-xyz/op-request-plugins@2.0.1
  - @nocturne-xyz/core@3.1.0
  - @nocturne-xyz/client@3.0.1
  - @nocturne-xyz/local-prover@0.4.7
  - @nocturne-xyz/subgraph-sync-adapters@0.3.1
  - @nocturne-xyz/offchain-utils@0.1.18

## 0.5.0

### Minor Changes

- 257799c9: Add ability to pass oz relayer speed to actors
- a6275d8a: - split `core` in half, creating a new `client` package that houses `NocturneClient` and everything around it
  - moved all "sync adapter" interfaces into `core`
  - moved all "sync adapter" implementations into data-source-specific packages `rpc-sync-adapters`, `subgraph-sync-adapters`, and `hasura-sync-adapters`

### Patch Changes

- Updated dependencies [b8628f56]
- Updated dependencies [22abab87]
- Updated dependencies [a6275d8a]
- Updated dependencies [6ec2a7ac]
- Updated dependencies [b8628f56]
  - @nocturne-xyz/op-request-plugins@2.0.0
  - @nocturne-xyz/core@3.0.0
  - @nocturne-xyz/client@3.0.0
  - @nocturne-xyz/subgraph-sync-adapters@0.3.0
  - @nocturne-xyz/contracts@1.1.1
  - @nocturne-xyz/local-prover@0.4.6
  - @nocturne-xyz/offchain-utils@0.1.17

## 0.4.1

### Patch Changes

- Updated dependencies [54b1caf2]
- Updated dependencies [e2801b16]
- Updated dependencies [2e641ad2]
- Updated dependencies [f80bff6a]
- Updated dependencies [5d90ac8e]
- Updated dependencies [5d90ac8e]
- Updated dependencies [8b3e1b2c]
- Updated dependencies [f80bff6a]
- Updated dependencies [5d90ac8e]
- Updated dependencies [fbfadb23]
- Updated dependencies [5d90ac8e]
  - @nocturne-xyz/contracts@1.1.0
  - @nocturne-xyz/core@2.2.0
  - @nocturne-xyz/config@1.2.0
  - @nocturne-xyz/op-request-plugins@1.0.1
  - @nocturne-xyz/local-prover@0.4.5
  - @nocturne-xyz/offchain-utils@0.1.16

## 0.4.0

### Minor Changes

- 07625550: add `--finality-blocks` CLI flag to pass `finalityBlocks` option through to `SDKSyncAdapter`

### Patch Changes

- 07625550: default to config's `finalityBlocks` in CLI if `--finality-blocks` is not given
- Updated dependencies [444321c0]
- Updated dependencies [444321c0]
- Updated dependencies [7c190c2c]
- Updated dependencies [07625550]
- Updated dependencies [444321c0]
- Updated dependencies [444321c0]
- Updated dependencies [07625550]
  - @nocturne-xyz/contracts@1.0.0
  - @nocturne-xyz/local-prover@0.4.4
  - @nocturne-xyz/core@2.1.0
  - @nocturne-xyz/op-request-plugins@1.0.0
  - @nocturne-xyz/config@1.1.0
  - @nocturne-xyz/offchain-utils@0.1.15

## 0.3.4

### Patch Changes

- Updated dependencies [16dfb275]
- Updated dependencies [dcea2acb]
  - @nocturne-xyz/core@2.0.2
  - @nocturne-xyz/local-prover@0.4.3
  - @nocturne-xyz/op-request-plugins@0.3.1
  - @nocturne-xyz/offchain-utils@0.1.14

## 0.3.3

### Patch Changes

- Updated dependencies [47a5f1e5]
- Updated dependencies [47a5f1e5]
- Updated dependencies [47a5f1e5]
- Updated dependencies [0ed9f872]
- Updated dependencies [46e47762]
- Updated dependencies [4d7147b6]
- Updated dependencies [7d151856]
- Updated dependencies [7d151856]
- Updated dependencies [46e47762]
  - @nocturne-xyz/op-request-plugins@0.3.0
  - @nocturne-xyz/config@1.0.0
  - @nocturne-xyz/core@2.0.1
  - @nocturne-xyz/contracts@0.5.0
  - @nocturne-xyz/local-prover@0.4.2
  - @nocturne-xyz/offchain-utils@0.1.13

## 0.3.2

### Patch Changes

- Updated dependencies [9fccc32f]
- Updated dependencies [543af0b0]
- Updated dependencies [543af0b0]
  - @nocturne-xyz/core@2.0.0
  - @nocturne-xyz/local-prover@0.4.1
  - @nocturne-xyz/op-request-plugins@0.2.1
  - @nocturne-xyz/offchain-utils@0.1.12

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
