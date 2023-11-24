# Changelog

## 7.2.0

### Minor Changes

- 5f493cdf: consensys is taking too long, revert firefox changes

### Patch Changes

- Updated dependencies [5f493cdf]
  - @nocturne-xyz/client@4.1.0
  - @nocturne-xyz/op-request-plugins@2.1.18

## 7.1.5

### Patch Changes

- fe573a44: Adds Protocol TVL

## 7.1.4

### Patch Changes

- Updated dependencies [08e6d2e0]
  - @nocturne-xyz/client@4.0.3
  - @nocturne-xyz/op-request-plugins@2.1.17

## 7.1.3

### Patch Changes

- Updated dependencies [8b9d9030]
  - @nocturne-xyz/core@3.3.0
  - @nocturne-xyz/client@4.0.2
  - @nocturne-xyz/idb-kv-store@0.4.14
  - @nocturne-xyz/local-prover@0.6.4
  - @nocturne-xyz/op-request-plugins@2.1.16
  - @nocturne-xyz/subgraph-sync-adapters@0.5.3

## 7.1.2

### Patch Changes

- b321b41b: remove op from history if submission fails
- Updated dependencies [b321b41b]
  - @nocturne-xyz/client@4.0.1
  - @nocturne-xyz/op-request-plugins@2.1.15

## 7.1.1

### Patch Changes

- Updated dependencies
  - @nocturne-xyz/client@4.0.0
  - @nocturne-xyz/op-request-plugins@2.1.14

## 7.1.0

### Minor Changes

- Fix rpc handler to expect params:null according to JSON-RPC spec

### Patch Changes

- Updated dependencies [c8cfc54c]
  - @nocturne-xyz/subgraph-sync-adapters@0.5.2

## 7.0.3

### Patch Changes

- c390746f: Publish via yarn publish-packages not yarn changeset publish
- Updated dependencies [c390746f]
  - @nocturne-xyz/client@3.4.3
  - @nocturne-xyz/op-request-plugins@2.1.13

## 7.0.2

### Patch Changes

- 9e63e754: log instead of throw on missing op history record
- 326fd2b2: add typed error for when user doesn't have enough funds for op request
- cadebb22: Expose extra items for gas est display
- Updated dependencies [9e63e754]
- Updated dependencies [326fd2b2]
  - @nocturne-xyz/client@3.4.2
  - @nocturne-xyz/op-request-plugins@2.1.12

## 7.0.1

### Patch Changes

- 87d5bb40: dummy bump
- Updated dependencies [87d5bb40]
  - @nocturne-xyz/client@3.4.1
  - @nocturne-xyz/config@1.7.3
  - @nocturne-xyz/core@3.2.1
  - @nocturne-xyz/idb-kv-store@0.4.13
  - @nocturne-xyz/local-prover@0.6.3
  - @nocturne-xyz/op-request-plugins@2.1.11
  - @nocturne-xyz/subgraph-sync-adapters@0.5.1

## 7.0.0

### Major Changes

- 35875d78: (BREAKING) split op flow into two steps - prepare and preform. this allows frontend to prepare ops and inspect the resulting op (gas, etc) before submission

### Patch Changes

- 3d9deaaf: dummy bump
- Updated dependencies [35875d78]
- Updated dependencies [3d9deaaf]
  - @nocturne-xyz/client@3.4.0
  - @nocturne-xyz/op-request-plugins@2.1.10

## 6.0.0

### Major Changes

- 21d65e2b: (BREAKING) split op flow into two steps - prepare and preform. this allows frontend to prepare ops and inspect the resulting op (gas, etc) before submission

### Patch Changes

- Updated dependencies [21d65e2b]
- Updated dependencies [f92a1cfe]
  - @nocturne-xyz/client@3.3.0

## 5.1.6

### Patch Changes

- Updated dependencies [7b0205b9]
  - @nocturne-xyz/op-request-plugins@2.1.9

## 5.1.5

### Patch Changes

- Don't throw if balances < total amount, on deposits

## 5.1.4

### Patch Changes

- f87b6457: use gas multiplier for deposit comp
- Updated dependencies [3ca99eaf]
  - @nocturne-xyz/subgraph-sync-adapters@0.5.0
  - @nocturne-xyz/core@3.2.0
  - @nocturne-xyz/client@3.2.1
  - @nocturne-xyz/idb-kv-store@0.4.12
  - @nocturne-xyz/local-prover@0.6.2
  - @nocturne-xyz/op-request-plugins@2.1.8

## 5.1.3

### Patch Changes

- 0a2b7455: Fix bps bug, protect against bad maxSlippageBps inputs
- Updated dependencies [c34c6b7a]
- Updated dependencies [9b17bc41]
- Updated dependencies [0a2b7455]
- Updated dependencies [feb897cf]
  - @nocturne-xyz/config@1.7.2
  - @nocturne-xyz/client@3.2.0
  - @nocturne-xyz/op-request-plugins@2.1.7

## 5.1.2

### Patch Changes

- empty bump
- Updated dependencies
  - @nocturne-xyz/op-request-plugins@2.1.6
  - @nocturne-xyz/subgraph-sync-adapters@0.4.2
  - @nocturne-xyz/idb-kv-store@0.4.11
  - @nocturne-xyz/local-prover@0.6.1
  - @nocturne-xyz/client@3.1.4
  - @nocturne-xyz/config@1.7.1
  - @nocturne-xyz/core@3.1.4

## 5.1.1

### Patch Changes

- 41671325: ensure frontend-sdk syncs when latestCommittedIndex != latestSyncedIndex
- 79aa7a82: Stop hardcoding subgraph url for dev and mainnet, require that to be passed via env
- 1d8de67d: Change eoa fetch source
- 94bb921c: Only register canon addr if not already
- Updated dependencies [41671325]
- Updated dependencies [8973d4cb]
- Updated dependencies [1d5cefc2]
- Updated dependencies [79aa7a82]
- Updated dependencies [4070b154]
  - @nocturne-xyz/client@3.1.3
  - @nocturne-xyz/local-prover@0.6.0
  - @nocturne-xyz/config@1.7.0
  - @nocturne-xyz/core@3.1.3
  - @nocturne-xyz/op-request-plugins@2.1.5
  - @nocturne-xyz/idb-kv-store@0.4.10
  - @nocturne-xyz/subgraph-sync-adapters@0.4.1

## 5.1.1-beta.0

### Patch Changes

- 41671325: ensure frontend-sdk syncs when latestCommittedIndex != latestSyncedIndex
- 79aa7a82: Stop hardcoding subgraph url for dev and mainnet, require that to be passed via env
- 1d8de67d: Change eoa fetch source
- 94bb921c: Only register canon addr if not already
- Updated dependencies [41671325]
- Updated dependencies [8973d4cb]
- Updated dependencies
- Updated dependencies [79aa7a82]
- Updated dependencies [4070b154]
  - @nocturne-xyz/client@3.1.3-beta.0
  - @nocturne-xyz/local-prover@0.6.0-beta.0
  - @nocturne-xyz/config@1.7.0-beta.0
  - @nocturne-xyz/core@3.1.3-beta.0
  - @nocturne-xyz/op-request-plugins@2.1.5-beta.0
  - @nocturne-xyz/idb-kv-store@0.4.10-beta.0
  - @nocturne-xyz/subgraph-sync-adapters@0.4.1-beta.0

## 5.1.0

### Minor Changes

- 8742f9a0: Stop leaking subgraph URLs, require them to be passed via env

### Patch Changes

- Updated dependencies [8742f9a0]
  - @nocturne-xyz/config@1.6.0
  - @nocturne-xyz/client@3.1.2
  - @nocturne-xyz/op-request-plugins@2.1.4

## 5.0.0

### Major Changes

- f2d04f65: (BREAKING) `HasuraSyncAdapter` takes network parameter and changes queries accordingly

## 4.1.0

### Minor Changes

- 4eddf89d: - keep a map of registered progress handlers for concurrent calls to `sync`
  - always `sync` with a `timeoutSeconds` of `5` no matter what caller passes in
- bb303f2d: make `generateAndStoreSpendKeyFromEoaSigIfNotAlreadySet` public
- 18f6e56c: update circuit artifacts

### Patch Changes

- 3961221a: fix edge cases in deposit status checkling logic
- 3b9cf081: Adds extra metadata for Uniswap V3 Swap ops
- b69ac2e8: Update signing eoa keygen message
- 5d92ae29: use timelag when syncing for reorg resistance
- Updated dependencies [3b9cf081]
- Updated dependencies [18f6e56c]
- Updated dependencies [1b2530d1]
  - @nocturne-xyz/op-request-plugins@2.1.3
  - @nocturne-xyz/client@3.1.1
  - @nocturne-xyz/local-prover@0.5.0
  - @nocturne-xyz/subgraph-sync-adapters@0.3.4
  - @nocturne-xyz/core@3.1.2
  - @nocturne-xyz/idb-kv-store@0.4.9

## 4.0.0

### Major Changes

- 85811df6: - collapse `syncWithProgress` and `sync` into a single `sync` method
  - change behavior of `syncMutex` such that duplicate calls to `sync` wait for the existing one to finish before returning

### Minor Changes

- 67b9116a: setSpendKey passes along eoa address, checks for spend key exists calls nocturne_requestSpendKeyEoa instead
- 23243741: (BREAKING) get rid of `optimsiticOpDigest` stuff and replace with OpHistory
- b56ead58: frontend-sdk persists history using `OpHistoryStore`

### Patch Changes

- 438f0e68: don't sync before firing off op
- 45d0719a: frontend-sdk computes gas comp for deposits if not given
- d4f6fa7b: getStatus closure returned by `makeGetStatus` gracefully handles edge case where op not in history
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
  - @nocturne-xyz/idb-kv-store@0.4.8
  - @nocturne-xyz/local-prover@0.4.8

## 3.1.4

### Patch Changes

- Updated dependencies [fc7fa6c4]
  - @nocturne-xyz/config@1.4.0
  - @nocturne-xyz/client@3.0.5
  - @nocturne-xyz/op-request-plugins@2.1.1

## 3.1.3

### Patch Changes

- 0d6f520d: change usage of syncMutex to prevent double sync
- 317a0708: fix snap keygen conversions
- Updated dependencies [caf815d8]
- Updated dependencies [e7dee7e1]
- Updated dependencies [317a0708]
  - @nocturne-xyz/op-request-plugins@2.1.0
  - @nocturne-xyz/client@3.0.4

## 3.1.2

### Patch Changes

- b49fd71f: Update ActionMetadata types to be consistent
- Updated dependencies [6fddaaa2]
- Updated dependencies [b49fd71f]
- Updated dependencies [a72e2077]
  - @nocturne-xyz/client@3.0.3
  - @nocturne-xyz/op-request-plugins@2.0.3
  - @nocturne-xyz/subgraph-sync-adapters@0.3.2

## 3.1.1

### Patch Changes

- Updated dependencies [abfab3f2]
  - @nocturne-xyz/config@1.3.1
  - @nocturne-xyz/client@3.0.2
  - @nocturne-xyz/op-request-plugins@2.0.2

## 3.1.0

### Minor Changes

- a94caaec: - postfix indexed db name with hash of user's canonical address to separate notes created under different keys
  - make `SnapStateSdk` ensure key is generated and set in snap before caller can invoke the snap
- a94caaec: add method for deriving key from an EOA sig and storing it in snap

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
  - @nocturne-xyz/idb-kv-store@0.4.7
  - @nocturne-xyz/local-prover@0.4.7
  - @nocturne-xyz/subgraph-sync-adapters@0.3.1

## 3.0.0

### Major Changes

- a6275d8a: - split `core` in half, creating a new `client` package that houses `NocturneClient` and everything around it
  - moved all "sync adapter" interfaces into `core`
  - moved all "sync adapter" implementations into data-source-specific packages `rpc-sync-adapters`, `subgraph-sync-adapters`, and `hasura-sync-adapters`

### Minor Changes

- 22abab87: add hasura sync adapters

### Patch Changes

- b8628f56: Adds plugins to fe-sdk
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
  - @nocturne-xyz/idb-kv-store@0.4.6
  - @nocturne-xyz/local-prover@0.4.6

## 2.0.0

### Major Changes

- 2e641ad2: update circuit artifacts

### Minor Changes

- 4229dbb5: Removes snap's clearDb method
- e2801b16: - abstract deposit-fetching logic behind a new `DepositAdapter` interface
  - implement `DepositAdapter` over subgraph
  - use `DepositAdapter` instead of subgraph-specific logic in SDK so that the SDK is decoupled from the subgraph
  - allow user to pass in a `DepositAdapter` via sdk options to override the default subgraph adapter

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
  - @nocturne-xyz/idb-kv-store@0.4.5
  - @nocturne-xyz/local-prover@0.4.5

## 1.1.2

### Patch Changes

- 7c190c2c: force sync methods to run with timing enabled
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
  - @nocturne-xyz/idb-kv-store@0.4.4

## 1.1.1

### Patch Changes

- Updated dependencies [16dfb275]
- Updated dependencies [dcea2acb]
  - @nocturne-xyz/core@2.0.2
  - @nocturne-xyz/idb-kv-store@0.4.3
  - @nocturne-xyz/local-prover@0.4.3
  - @nocturne-xyz/op-request-plugins@0.3.1

## 1.1.0

### Minor Changes

- 47a5f1e5: Add initiateAnonEthTransfer method that uses EthTransferAdapterPlugin
- 47a5f1e5: Add getter for getting op request builder from fe sdk + expose performOperation function that prepares/submits op

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
  - @nocturne-xyz/idb-kv-store@0.4.2
  - @nocturne-xyz/local-prover@0.4.2

## 1.0.0

### Major Changes

- 543af0b0: Replace sepolia with goerli everywhere now that we're migrating testnets

### Patch Changes

- Updated dependencies [9fccc32f]
- Updated dependencies [543af0b0]
- Updated dependencies [543af0b0]
  - @nocturne-xyz/core@2.0.0
  - @nocturne-xyz/idb-kv-store@0.4.1
  - @nocturne-xyz/local-prover@0.4.1
  - @nocturne-xyz/op-request-plugins@0.2.1

## 0.4.0

### Minor Changes

- ff4fc598: switch on network name to figure out which S3 bucket to pull circuit artifacts from
- 9b1fd626: - use `IdbKvStore` for persistent sync state
- 77c4063c: Add functionality to snap/fe-sdk that supports signing a canon addr registry entry and returning necessary inputs for sig check proof gen
- 15dbe9d0: Add adapter types for deposits at the frontend-sdk layer
- 9098e2c8: Update op request builder instantiation to take provider, chainid, and optional teller contract after adding provider support to builder
- 3be7d366: Strongly typed both sides of the JSON RPC boundary, between fe-sdk & snap. Shared in core
- 589e0230: add sdk support for generating CanonAddrSigCheck proofs

### Patch Changes

- 86d484ad: - implement plugin system for `OperationRequestBuilder` and update APIs accordingly
- 04f74995: Add param to retrievePendingDeposit to choose between WETH or ETH
- 6abd69b9: Update op request builder build() calls to be awaited
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
- Updated dependencies [9b1fd626]
  - @nocturne-xyz/core@1.0.0
  - @nocturne-xyz/contracts@0.4.0
  - @nocturne-xyz/op-request-plugins@0.2.0
  - @nocturne-xyz/config@0.4.0
  - @nocturne-xyz/local-prover@0.4.0
  - @nocturne-xyz/idb-kv-store@0.4.0

## 0.3.2

### Patch Changes

- Republishing due to missed fixes in 0.3.1

## 0.3.1

### Patch Changes

- 14d0ac58: fix snap<>fe-sdk bug, ensure fe-sdk stringifies all snap params, ensure snap parses them

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

- Refactor API:
  - `NocturneFrontendSDK` renamed to `NocturneSDK`
  - remove async init
  - add new types `DepositHandle` and `OperationHandle` that abstract away status fetching
  - "flatten" deposit statuses from chain vs screener into a single `DepositStatus` enum
  - add utils for connecting to / interacting with the snap
  - change `metadata` type
- `sync` method takes and propogates `SyncOpts` as params to snap/sdk
- instantiate fe-sdk with `config`
- add method to fetch operation status from bundler
- in `verifyProvenOperation`, mask `encodedAsset` PIs to 0 if `publicSpend` is 0
- forward `SubmittableOperation` to bundler now that operation format has changed post min return value changes
- instantiate fe-sdk with just `configName`
- update `proveOperation` with new `JoinSplitInput`s
- add method to fetch operationstatus from bundler
- have `anonTransferErc20` format/pass metadata to snap
- wrap fetch requests in `async-retry` with exponential backoff
- add method to fetch all inflight op digests and metadata `getInflightOpDigestsAndMetadata`
- `sdk.requestSignOperation` takes optional `OperationMetadata` parameter which is stored in wallet while op is still in flight
- add `anonTransferErc20` method and call instead of building request in test site index.ts
- make endpoint passing struct based to avoid future mixups
- fix DepositForm bugs post adding ETH
- fix `submitProvenOperation` function to use new relay schema
- make deposit form include ETH as option
- add methods for querying screener for status and quote
- fix deposit functionality for erc20 and eth deposits
- Add displays for `OPERATION_PROCESSING_FAILED` AND `OPERATION_EXECUTION_FAILED`
- add error message for `BUNDLE_REVERTED` to `TransactionTracker`
- Remove references to `vault` and instead approve `wallet`
- use `proveOperation` instead of `OpProver`
- remove separate `syncLeaves` method and rename `syncNotes` to `sync`
- clean up module hierarchy, remove unnecessary exports, and make exports explicit
- adapt to breaking changes in MM Flask
- rename methods to make intended usage clearer
- update imports for new decoupled `NocturneContext` functionality
- update imports for new `AssetTrait`
- update imports with SDK renames (see SDK changelog)
- make `TransactionTracker` take `className` so we can use it with `styled-components`
- remove progress count from `TransactionTracker`
- Deposit form parses token amount in proper decimal amount
- Add symbol/decimal fetching and display to balance display component
- Abbreviate token addresses and show call sig instead of calldata for actions
- Add `DepositForm` component
- Add erc20/721/1155 JSON abis for token approvals
- Add `depositFunds` method to `NocturneFrontendSDK`, which required sdk taken wallet and vault addresses
- fix overwriting of gas and refunds in `generateProvenOperation`
- add method to verify operation proofs
- add `TransactionTracker` component
- Use `makePostProofJoinSplitTx` in `generateProvenOperation`
- Change default `WASM_PATH` from `./joinsplit.wasm` to `/joinsplit.wasm`
- Remove `toJSON` and all `fromJSON` methods in favor of custom `bigint-json-serialization`
- Add `frontend-sdk` package with ability to generate proofs from browser given `operationRequest` and read all asset balances
