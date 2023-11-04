---
"@nocturne-xyz/frontend-sdk": minor
---

- keep a map of registered progress handlers for concurrent calls to `sync`
- always `sync` with a `timeoutSeconds` of `5` no matter what caller passes in
