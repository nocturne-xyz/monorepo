---
"@nocturne-xyz/frontend-sdk": minor
---

- abstract deposit-fetching logic behind a new `DepositAdapter` interface
- implement `DepositAdapter` over subgraph
- use `DepositAdapter` instead of subgraph-specific logic in SDK so that the SDK is decoupled from the subgraph
- allow user to pass in a `DepositAdapter` via sdk options to override the default subgraph adapter
