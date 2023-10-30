# Changelog

## 0.9.1

### Patch Changes

- Updated dependencies [fc7fa6c4]
  - @nocturne-xyz/config@1.4.0

## 0.9.0

### Minor Changes

- 724869eb: - update CLIs to reflect new logger semantics
  - replace all console logs with logger invocations
- 9cac0822: Add trm tx monitor command to screener CLI to submit outflows to TRM

### Patch Changes

- 821dc829: Update severe counterparty exposure and add rule to ruleset for < 30k
- 891de7e5: Change log level flag to just --log-level
- Updated dependencies [724869eb]
- Updated dependencies [891de7e5]
  - @nocturne-xyz/offchain-utils@0.3.0

## 0.8.0

### Minor Changes

- 3bdcf85e: Add inspect top level CLI command with snapshot and check commands
- 717ebcba: integrate cachedFetch into ruleset and update tests

### Patch Changes

- 66cbfb14: Tweak screener limits
- 3bdcf85e: Replace snapshot gen script with call to deposit-screener-cli snapshot call
- 026718d2: Fix bug in screener inspect CLI where output dir/files were not being correctly created before command run
- Updated dependencies [26c43e44]
- Updated dependencies [2c465f4e]
- Updated dependencies [717ebcba]
- Updated dependencies [a72e2077]
  - @nocturne-xyz/offchain-utils@0.2.0
  - @nocturne-xyz/subgraph-sync-adapters@0.3.2

## 0.7.2

### Patch Changes

- Updated dependencies [abfab3f2]
  - @nocturne-xyz/config@1.3.1

## 0.7.1

### Patch Changes

- Updated dependencies [c717e4d9]
- Updated dependencies [d89a77e4]
- Updated dependencies [a94caaec]
- Updated dependencies [c717e4d9]
  - @nocturne-xyz/contracts@1.2.0
  - @nocturne-xyz/config@1.3.0
  - @nocturne-xyz/core@3.1.0
  - @nocturne-xyz/subgraph-sync-adapters@0.3.1
  - @nocturne-xyz/offchain-utils@0.1.18

## 0.7.0

### Minor Changes

- 257799c9: Add ability to pass oz relayer speed to actors
- a6275d8a: - split `core` in half, creating a new `client` package that houses `NocturneClient` and everything around it
  - moved all "sync adapter" interfaces into `core`
  - moved all "sync adapter" implementations into data-source-specific packages `rpc-sync-adapters`, `subgraph-sync-adapters`, and `hasura-sync-adapters`

### Patch Changes

- ac6564cd: Tornado → Nocturne screener bypass protection
- Updated dependencies [22abab87]
- Updated dependencies [a6275d8a]
- Updated dependencies [6ec2a7ac]
  - @nocturne-xyz/core@3.0.0
  - @nocturne-xyz/subgraph-sync-adapters@0.3.0
  - @nocturne-xyz/contracts@1.1.1
  - @nocturne-xyz/offchain-utils@0.1.17

## 0.6.0

### Minor Changes

- e2801b16: (breaking) move `fetchDepositEvents` from `core` to `deposit-screener`

### Patch Changes

- 7b21fdff: Add `DeFi Whale` and `Twitter` MistTrack Label threshold screener bypass
- 78ced423: Added snapshot generation script to test suite, consume from snapshot
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
  - @nocturne-xyz/offchain-utils@0.1.16

## 0.5.0

### Minor Changes

- 07625550: - CLI takes `finalityBlocks` from config and overrides with `--finality-blocks` option
  - submitter `tx.wait`'s for `finalityBlocks`
- 07625550: add support for `finalityBlocks` sync option

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
  - @nocturne-xyz/offchain-utils@0.1.15

## 0.4.3

### Patch Changes

- Updated dependencies [16dfb275]
- Updated dependencies [dcea2acb]
  - @nocturne-xyz/core@2.0.2
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
  - @nocturne-xyz/offchain-utils@0.1.13

## 0.4.1

### Patch Changes

- Updated dependencies [9fccc32f]
- Updated dependencies [543af0b0]
- Updated dependencies [543af0b0]
  - @nocturne-xyz/core@2.0.0
  - @nocturne-xyz/offchain-utils@0.1.12

## 0.4.0

### Minor Changes

- fc364ae8: Integrating Ruleset usage into screener server
- 016af4b6: Add unit tests, update internals

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
- Updated dependencies [35b0f76f]
- Updated dependencies [77c4063c]
- Updated dependencies [589e0230]
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
  - @nocturne-xyz/config@0.4.0
  - @nocturne-xyz/offchain-utils@0.1.11

## 0.3.0

### Minor Changes

- fix publish command

### Patch Changes

- Updated dependencies
  - @nocturne-xyz/contracts@0.3.0
  - @nocturne-xyz/config@0.3.0
  - @nocturne-xyz/core@0.3.0

## 0.2.0

### Minor Changes

- 6c0a5d7c: overhaul monorepo structure & start proper versioning system

### Patch Changes

- Updated dependencies [6c0a5d7c]
  - @nocturne-xyz/contracts@0.2.0
  - @nocturne-xyz/config@0.2.0
  - @nocturne-xyz/core@0.1.4

### Unreleased

- replace tx manager with OZ relay
- revert back to ethers eip712 signer after fixing typehash ordering
- switch on screening/delay components in server/processor CLI
- delete all dummy magic values and hardcode into dummy impls
- add ENVIRONMENT env var to make sure we don't use dev values in production
- fix bug where res.json(...) in deposit DNE case was not returning immediately after
- fix bug where screener method to find closest job doesn't use our bigint JSON library
- return errors to user in screener server /quote
- use tx manager
- return successfully with deposit status `DoesNotExist` if the given deposit request DNE
- use error code 500, not 400 for wait estimation failures
- fix server cli to also take `--dummy-screener-delay`
- add dummy magic long delay value to cause dummy screener to give 3h delay
- add dummy magic rejection value for screener to reject some deposits (test purposes)
- put back redis utils
- make logging more consistent
- add logger to `SubgraphScreenerSyncAdapter`
- sync through current block, not merely up to it
- randomness to screener delay
- fix edge case that can cause totalEntityIndex to go backwards in subgraph sync adapter
- sync by TotalEntityIndex instead of block ranges
- check in screener and fulfiller that deposit request still outstanding
- fix bug in docker compose that pointed to bundler package not screener
- instrument screener and fulfiller components with opentel metrics
- add health check to server
- add dummy screening delay option to processor CLI
- subgraph sync checks if `res.data` undefined
- use custom implementation of EIP712 signer instead of ethers
- make EIP712 typehash / signature to use new compressed address encoding
- fix wrong service name in bundler server run cmd
- server start returns `ActorHandle` and awaits promise to avoid early exit
- bump sdk with joinsplit sorting and note timestamp changes
- move deposit hash calculation into sdk, fix imports
- make cli manually exit when `ActorHandle` promise resolves
- move req/res types into sdk so it can be shared with fe-sdk
- remove all usage of ticker in processor and server (strictly worse than address, more clutter)
- add server component which exposes `/status/:depositHash` and `/quote`
- expose two methods in `waitEstimation` to estimate time for existing deposits and for prospective deposits
- add `waitEstimation` module which takes queue and delay and gives rough estimate of aggregate delay
- rename `delay` module to `screenerDelay` so its clear its delay from first screen to second
- DB stores depositHash -> depositRequest in screener for future use (alternative was using subgraph)
- close other workers/iters/async "threads" when one of them fails
- add window recovery logic to fulfiller
- add fulfiller to `docker-compose.yml`
- add fulfiller to CLI
- add fulfillment queue logic in `DepositScreenerFulfiller`
  - have separate fulfillment queue for each asset
  - make a bullmq `Worker` for each queue that enforces rate limit
  - move tx submission into fulfiller
- add `DepositRateLimiter` that keeps track of a moving window of recent deposits and can check if rate limit would be exceeded.
- update `.env.example`
- go back to only one docker-compose file
- add `--stdout-log-level` option to CLI
- processor switches on token type and calls `completeErc20Deposit`
- add `--throttle-ms` arg to CLI
- bump max chunk size up to 100K blocks
- add optional argument `queryThrottleMs` to `DepositScreenerProcessor.start` and use it when instantiating iterator
- add support for `throttleMs` option to sync adapter
- pull `startBlock` from `config.contracts` and pass it to `startBlock` in processor cli
- add `startBlock` parameter to `DepositScreenerProcessor`
- subgraph fetch functions query via `idx_gte` and `idx_lt` instead of `id_gte` and `id_lt`
- create separate `docker-compose.local.yml` and `docker-compose.dev.yml` where `dev` version pulls from docker hub
- tag docker image with nocturnelabs org name
- add `yarn build:docker-compose` which builds docker compose
- `yarn build:docker` now builds CLI container, not docker compose.
- CLI uses config package to get contract addresses
- add `--log-dir` option to CLI with defaults
- add winston logging
- add 5 retries with exponential backoff to deposit screener
- fix `SubgraphScreenerSyncAdapter` querying entire history instead of only specified range
- Update eip712 signing to not include `chainId` in `DepositRequest` (already included in eip712 domain)
- make processor stoppable by renaming `run` to `start` and returning a "close" function
- print errors in console
- Fix bug where `depositRequest.depositAddr` was being incorrectly copied over from subgraph
- Add Dockerfile and docker-compose.yml
- Delete `enqueue.ts` and move logic into `processor.ts`
- Move env var parsing to CLI
- Add stubs for non-server screener functionality
  - Processor (fetches new deposit events, checks, enqueues)
  - Submitter (takes new deposit requests of queue and signs/submits)
  - DB implementation for storing rate limits and statuses
  - Sync submodule that currently only has subgraph impl
  - CLI submodule to start components
  - Screening submodule (mocked)
  - Delay sumodule (mocked)
- Break out signing and hashing into `typeData` submodule
- Add deposit request hash to contract fixture
- Add subgraph query functionality + test script to ensure it works
- Add EIP712 signing logic + script for generating fixture
