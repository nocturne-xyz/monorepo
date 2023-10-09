---
"@nocturne-xyz/frontend-sdk": minor
---

- postfix indexed db name with hash of user's canonical address to separate notes created under different keys
- make `SnapStateSdk` ensure key is generated and set in snap before caller can invoke the snap
