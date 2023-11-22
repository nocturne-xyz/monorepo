---
"@nocturne-xyz/offchain-utils": patch
---

fix bug where response.clone() was prematurely consuming response, ser then deser to deep copy
