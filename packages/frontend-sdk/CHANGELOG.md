# Changelog

### Unreleased

- Add `DepositForm` component
- Add erc20/721/1155 JSON abis for token approvals
- Add `depositFunds` method to `NocturneFrontendSDK`, which required sdk taken wallet and vault addresses
- Change default `WASM_PATH` from `./joinsplit.wasm` to `/joinsplit.wasm`
- Remove `toJSON` and all `fromJSON` methods in favor of custom `bigint-json-serialization`
- Add `frontend-sdk` package with ability to generate proofs from browser given `operationRequest` and read all asset balances
