# Changelog

## 0.5.1

### Patch Changes

- Updated dependencies [c717e4d9]
- Updated dependencies [d89a77e4]
- Updated dependencies [a94caaec]
- Updated dependencies [c717e4d9]
  - @nocturne-xyz/contracts@1.2.0
  - @nocturne-xyz/config@1.3.0
  - @nocturne-xyz/core@3.1.0
  - @nocturne-xyz/persistent-log@0.1.8
  - @nocturne-xyz/offchain-utils@0.1.18

## 0.5.0

### Minor Changes

- 257799c9: Add ability to pass oz relayer speed to actors
- a6275d8a: - split `core` in half, creating a new `client` package that houses `NocturneClient` and everything around it
  - moved all "sync adapter" interfaces into `core`
  - moved all "sync adapter" implementations into data-source-specific packages `rpc-sync-adapters`, `subgraph-sync-adapters`, and `hasura-sync-adapters`

### Patch Changes

- Updated dependencies [22abab87]
- Updated dependencies [a6275d8a]
- Updated dependencies [6ec2a7ac]
  - @nocturne-xyz/core@3.0.0
  - @nocturne-xyz/contracts@1.1.1
  - @nocturne-xyz/persistent-log@0.1.7
  - @nocturne-xyz/offchain-utils@0.1.17

## 0.4.5

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
  - @nocturne-xyz/persistent-log@0.1.6
  - @nocturne-xyz/offchain-utils@0.1.16

## 0.4.4

### Patch Changes

- Updated dependencies [444321c0]
- Updated dependencies [444321c0]
- Updated dependencies [7c190c2c]
- Updated dependencies [07625550]
- Updated dependencies [444321c0]
- Updated dependencies [07625550]
  - @nocturne-xyz/contracts@1.0.0
  - @nocturne-xyz/core@2.1.0
  - @nocturne-xyz/config@1.1.0
  - @nocturne-xyz/persistent-log@0.1.5
  - @nocturne-xyz/offchain-utils@0.1.15

## 0.4.3

### Patch Changes

- Updated dependencies [16dfb275]
- Updated dependencies [dcea2acb]
  - @nocturne-xyz/core@2.0.2
  - @nocturne-xyz/persistent-log@0.1.4
  - @nocturne-xyz/offchain-utils@0.1.14

## 0.4.2

### Patch Changes

- Updated dependencies [47a5f1e5]
- Updated dependencies [0ed9f872]
- Updated dependencies [46e47762]
- Updated dependencies [4d7147b6]
- Updated dependencies [7d151856]
- Updated dependencies [7d151856]
- Updated dependencies [46e47762]
  - @nocturne-xyz/config@1.0.0
  - @nocturne-xyz/core@2.0.1
  - @nocturne-xyz/contracts@0.5.0
  - @nocturne-xyz/persistent-log@0.1.3
  - @nocturne-xyz/offchain-utils@0.1.13

## 0.4.1

### Patch Changes

- Updated dependencies [9fccc32f]
- Updated dependencies [543af0b0]
- Updated dependencies [543af0b0]
  - @nocturne-xyz/core@2.0.0
  - @nocturne-xyz/persistent-log@0.1.2
  - @nocturne-xyz/offchain-utils@0.1.12

## 0.4.0

### Minor Changes

- d38c29ef: use standalone persistent-log and axe old version

### Patch Changes

- Updated dependencies [6abd69b9]
- Updated dependencies [81598815]
- Updated dependencies [003e7082]
- Updated dependencies [1ffcf31f]
- Updated dependencies [fc364ae8]
- Updated dependencies [0cb20e3d]
- Updated dependencies [86d484ad]
- Updated dependencies [589e0230]
- Updated dependencies [6998bb7c]
- Updated dependencies [1ffcf31f]
- Updated dependencies [77c4063c]
- Updated dependencies [6998bb7c]
- Updated dependencies [77c4063c]
- Updated dependencies [58b363a4]
- Updated dependencies [35b0f76f]
- Updated dependencies [77c4063c]
- Updated dependencies [589e0230]
- Updated dependencies [3be7d366]
- Updated dependencies [9098e2c8]
- Updated dependencies [de88d6f0]
- Updated dependencies [27cb1b5c]
- Updated dependencies [58b363a4]
- Updated dependencies [003e7082]
- Updated dependencies [77c4063c]
- Updated dependencies [58b363a4]
- Updated dependencies [f8046431]
  - @nocturne-xyz/core@1.0.0
  - @nocturne-xyz/contracts@0.4.0
  - @nocturne-xyz/config@0.4.0
  - @nocturne-xyz/crypto-utils@0.3.1
  - @nocturne-xyz/persistent-log@0.1.1
  - @nocturne-xyz/offchain-utils@0.1.11

## 0.3.0

### Minor Changes

- fix publish command

### Patch Changes

- Updated dependencies
  - @nocturne-xyz/crypto-utils@0.3.0
  - @nocturne-xyz/contracts@0.3.0
  - @nocturne-xyz/config@0.3.0
  - @nocturne-xyz/core@0.3.0

## 0.2.0

### Minor Changes

- 6c0a5d7c: overhaul monorepo structure & start proper versioning system

### Patch Changes

- Updated dependencies [6c0a5d7c]
  - @nocturne-xyz/crypto-utils@0.2.0
  - @nocturne-xyz/contracts@0.2.0
  - @nocturne-xyz/config@0.2.0
  - @nocturne-xyz/core@0.1.4

### Unreleased

- replace tx manager with OZ relay
- rewrite `SubtreeUpdater` class to not use bullmq. instead it's just one big `ClosableAsyncIterator`
- remove duplicated `log.push` call in `syncAndPipe` to fix double insertion bug
- add metrics
- use tx manager
- iterate over `PersistentLog` first, then start pulling from subgraph
- add `PersistentLog`
- put back redis utils
- make logging more consistent
- add logger to `SubgraphSubtreeUpdaterSyncAdapter`
- sync through current block, not merely up to it
- make teardown actually wait for all proms to settle
- fix edge case that can cause totalEntityIndex to go backwards in subgraph sync adapter
- sync `TreeInsertioEvent`s instead of notes and fill batch events individually
- sync by TotalEntityIndex instead of block ranges
- reduce chunk size down from 100000 to 50
- use merkle index from insertions instead of separate counter
- subgraph sync checks if `res.data` undefined
- change sync adapter to use joinsplits, refunds, and fill batch with zero events to yield insertions
- bump sdk with joinsplit sorting and note timestamp changes
- import `BATCH_SIZE` from `TreeConstants`
- make cli manually exit when `ActorHandle` promise resolves
- get `subtreeIndex`, not `subtreeBatchOffset` from subgraph when determining whether or not to enqueue proof job
- close other workers/iters/async "threads" when one of them fails
- add `--stdout-log-level` post-rewrite
- pull start block from config in cli
- ignore fill batch failure in case where batch already filled
- only prune tree after proof job is submitted to bullmq
- update .env.example
- add docker-compose file
- complete overhaul, including the following changes:
  - syncAdapter iterates over tree insertions
  - no persistence - instead recovers by scanning through insertions from subgraph
  - skips proving for already-submitted updates
  - fillBatch logic is now based on a cancellable timeout that's overridden every time an insertion is made instead of an interval
  - bullMQ to handle / persist queued / unfinished / failed jobs
  - redis instead of lmdb
- add `--stdout-log-level` option to CLI
- tag docker images with nocturnelabs org name
- scan through all insertions starting from index 0 when recovering
- take handler address via config in CLI via `--config-name-or-path`
- add `--log-dir` option to CLI with defaults
- add winston logging
- make `SubtreeUpdateServer.start()` non-async, as it doesn't need to be async
- get rid of mutex on submitter
- add `tx.wait` to submitter
- Sync tree events from `handler` contract instead of wallet post-contract-separation
- move `packToSolidityProof`, `unpackFromSolidityProof`, and `SolidityProof` into `proof/utils`
- Rename `SUBMITTER_SECRET_KEY` to `TX_SIGNER_KEY`
- Add separate script for building mock docker
- update imports with SDK renames (see SDK changelog)
- add mutex to avoid nonce conflicts when filling batch (hack)
- add CLI option to ensure a batch is submitted every time the updater polls by filling with zeros
- Add `interval` and `indexingStartBlock` as options to server
- Remove circuit-artifacts download for mock updater
- change `build_docker.sh` to avoid `docker buildx` when building mock subtree updater
- add `yarn build:mock:docker` script and corresponding functionality in `build_docker.sh`
- create separate subtree updater dockerfile that doesn't use rapidsnark
- change CLI to allow using mock subtree update prover
- fix dir not existing in rapidsnark prover
- remove install deps from dockerfile
- Add a script `yarn build:docker` to build the dockerized subtree updater
- Switch to CLI options for all non-secrets
- Add CLI instructions to readme
- Move most CLI params into env vars
- Dockerize
- Remove `toJSON` and all `fromJSON` methods in favor of custom `bigint-json-serialization`
- modify `SubtreeUpdater` to index `SubtreeUpdate` events and use those to determine when insertions are committed
- spit `tryGenAndSubmitProofs` into separate method
- separately enqueue batches to be committed
- move server to its own module
- add tests for rapidsnark prover
- add `SubtreeUpdater`
- add rapidsnark prover
