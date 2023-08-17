# Changelog

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
