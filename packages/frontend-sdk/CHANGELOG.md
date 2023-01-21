# Changelog

### Unreleased

- add method to verify operation proofs
- add `TransactionTracker` component
- Use `makePostProofJoinSplitTx` in `generateProvenOperation`
- Change default `WASM_PATH` from `./joinsplit.wasm` to `/joinsplit.wasm`
- Remove `toJSON` and all `fromJSON` methods in favor of custom `bigint-json-serialization`
- Add `frontend-sdk` package with ability to generate proofs from browser given `operationRequest` and read all asset balances
