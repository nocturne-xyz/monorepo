---
"@nocturne-xyz/frontend-sdk": major
---

- collapse `syncWithProgress` and `sync` into a single `sync` method
- change behavior of `syncMutex` such that duplicate calls to `sync` wait for the existing one to finish before returning
