---
"@nocturne-xyz/core": patch
---

Op request gas estimation existing joinsplit case uses the entries in gasAsset estimation mapping NOT the whole map (bug led to underestimation)
