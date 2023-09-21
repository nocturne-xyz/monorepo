# Changelog

## 0.4.2

### Patch Changes

- Updated dependencies [47a5f1e5]
- Updated dependencies [0ed9f872]
- Updated dependencies [46e47762]
- Updated dependencies [4d7147b6]
  - @nocturne-xyz/config@1.0.0
  - @nocturne-xyz/core@2.0.1

## 0.4.1

### Patch Changes

- Updated dependencies [9fccc32f]
- Updated dependencies [543af0b0]
- Updated dependencies [543af0b0]
  - @nocturne-xyz/core@2.0.0

## 0.4.0

### Minor Changes

- 77c4063c: Add functionality to snap/fe-sdk that supports signing a canon addr registry entry and returning necessary inputs for sig check proof gen
- 81598815: - remove all methods except for `nocturne_signOperation`
  - add new method `nocturne_requestViewingKey`

### Patch Changes

- 1ffcf31f: update contract and sdk bundler gas comp estimate numbers
- 86d484ad: - implement plugin system for `OperationRequestBuilder` and update APIs accordingly
- 6998bb7c: add resetWindowHours to deploy config in config package and deploy package
- 589e0230: add RPC method for generating canon addr sig
- 3be7d366: Strongly typed both sides of the JSON RPC boundary, between fe-sdk & snap. Shared in core
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
- Updated dependencies [58b363a4]
- Updated dependencies [35b0f76f]
- Updated dependencies [77c4063c]
- Updated dependencies [589e0230]
- Updated dependencies [3be7d366]
- Updated dependencies [9098e2c8]
- Updated dependencies [58b363a4]
- Updated dependencies [003e7082]
- Updated dependencies [77c4063c]
- Updated dependencies [58b363a4]
- Updated dependencies [f8046431]
  - @nocturne-xyz/core@1.0.0
  - @nocturne-xyz/config@0.4.0
  - @nocturne-xyz/crypto-utils@0.3.1

## 0.3.2

### Patch Changes

- use opts for get notes opts single for getBalanceForAsset

## 0.3.1

### Patch Changes

- 14d0ac58: fix snap<>fe-sdk bug, ensure fe-sdk stringifies all snap params, ensure snap parses them

## 0.3.0

### Minor Changes

- fix publish command

### Patch Changes

- Updated dependencies
  - @nocturne-xyz/crypto-utils@0.3.0
  - @nocturne-xyz/config@0.3.0
  - @nocturne-xyz/core@0.3.0

## 0.2.0

### Minor Changes

- 6c0a5d7c: overhaul monorepo structure & start proper versioning system

### Patch Changes

- Updated dependencies [6c0a5d7c]
  - @nocturne-xyz/crypto-utils@0.2.0
  - @nocturne-xyz/config@0.2.0
  - @nocturne-xyz/core@0.1.4

### Unreleased

- Add `lastSyncedMerkleIndex` usage if sync already is taking place
- remove custom gas est call in snap and let sdk handle
- `nocturne_sync` takes and propagates `SyncOpts` as params
- change spend key derivation to `keccak256(bip44Node.privateKey)`
- remove use of winston logger
- fix bug where snap was parsing op metadata as `.metadata` not `.opMetadata`
- setup browser logger for SDK to use
- add method to fetch all inflight op digests and metadata `nocturne_getInflightOpDigestsAndMetadata`
- parse metadata param in `nocturne_signOperation` method and pass to `applyOptimisticRecordsForOp` call
- lock snaps-cli to finalized version `0.32.2` (https://github.com/MetaMask/snaps/discussions/1411)
- apply op's nullifiers to SDK's optimsitic nullifiers at the end of `nocturne_signOperation`
- update SDK's optimistic nullifiers after each sync
- call `loadNocturneConfigBuiltin("localhost")` instead of copying config from `config` package into snap
- throw error when `snap_dialog` returns a falsy value (unlike `snap_confirm`, `snap_dialog` doesn't do this for you);
- snap slurps up real config - not dummy config - using JSON module
- Snap takes handler contract addr for SDK not wallet
- if op doesn't have `gasPrice` set, set it to chain's current gas price
- set `gasAssets` in `DUMMY_CONFIG`
- use new `NocturneWalletSDK` instead of `NocturneContext`
- make `SnapKVStore` only dump on writes by putting the inner KV store in a thunk
- use `SubgraphSyncAdapter` against local graph node
- call `context.sync()` at the beginning of `nocturne_signOperation` so it's unnecessary for frontend to explicitly sync
- remove `syncLeaves` method and rename `syncNotes` to `sync` (only one `sync` method)
- Fix regression where key derivation was still using `wallet` keyword instead of `snap`
- adapt to breaking changes in MM Flask
- fix SK being derived in wrong field
- move to monorepo
- Bump SDK to 1.0.70-alpha
- Bump SDK to 1.0.66-alpha
- Bump SDK to 1.0.60-alpha to include joinsplit processing after refund processing fix
- Add `START_BLOCK` and `RPC_URL` consts for overriding
- Bump sdk to 1.0.55-alpha
- Bump sdk to 1.0.50-alpha to include unawaited promises when processing refunds/joinsplits
- print error when `tryGetPreProofOperation` fails
- don't set default gas params when getting joinsplit inputs
- update SDK
- set node version in changelog to 18.12.1
- remove default `verificationGas` and `gasPrice`
- clean up resolutions
- fix missing await bugs
- Add permission to manifest for `snap_getBip44Entropy`.
- Remove `SnapDB` in place of `SnapKvStore` after sdk db refactor (remove inheritance)
- Update SDK after removing `toJSON` and `fromJSON` methods
- Move to separate repo and rename flax to nocturne
- Expose methods to sync notes, sync leaves, and provide web page with pre-proof spend tx inputs and proof inputs (currently points to hh local node and hardcode addresses)
- Start `snap` package
