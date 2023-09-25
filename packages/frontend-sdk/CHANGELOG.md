# Changelog

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
