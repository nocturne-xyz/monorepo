---
"@nocturne-xyz/contracts": patch
---

Add onlyEoa check for processBundle to ensure processBundle cannot be called atomically with another action like a DEX imbalance
