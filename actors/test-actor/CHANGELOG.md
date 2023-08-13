# Changelog

## 0.1.0

### Patch Changes

- Updated dependencies [a65bf2a9]
  - @nocturne-xyz/local-prover@0.1.1
  - @nocturne-xyz/contracts@0.1.1
  - @nocturne-xyz/config@0.1.1
  - @nocturne-xyz/sdk@0.1.1

### Pre-Release

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
