# Changelog

### Unreleased

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
