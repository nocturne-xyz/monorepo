# Changelog

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
