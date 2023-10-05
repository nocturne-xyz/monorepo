---
"@nocturne-xyz/op-request-plugins": major
"@nocturne-xyz/frontend-sdk": major
"@nocturne-xyz/client": major
"@nocturne-xyz/core": major
"@nocturne-xyz/subgraph-sync-adapters": minor
"@nocturne-xyz/hasura-sync-adapters": minor
"@nocturne-xyz/deposit-screener": minor
"@nocturne-xyz/insertion-writer": minor
"@nocturne-xyz/subtree-updater": minor
"@nocturne-xyz/rpc-sync-adapters": minor
"@nocturne-xyz/e2e-tests": minor
"@nocturne-xyz/test-actor": minor
"@nocturne-xyz/deploy": minor
"@nocturne-xyz/bundler": minor
"@nocturne-xyz/snap": minor
---

- split `core` in half, creating a new `client` package that houses `NocturneClient` and everything around it
- moved all "sync adapter" interfaces into `core`
- moved all "sync adapter" implementations into data-source-specific packages `rpc-sync-adapters`, `subgraph-sync-adapters`, and `hasura-sync-adapters`
