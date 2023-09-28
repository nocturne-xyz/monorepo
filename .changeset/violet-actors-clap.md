---
"@nocturne-xyz/crypto": minor
---

- override noble `fromBytes` with one that throws an error if the encoding is invalid
- add `fromBytesUnsafe` that returns null if encoding is invalid
- make `BabyJubJubHybridCipher` more constant-time
