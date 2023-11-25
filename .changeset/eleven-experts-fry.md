---
"@nocturne-xyz/core": major
---

- (BREAKING) `SparseMerkleProver` no longer takes `KVStore` in ctor
- (BREAKING) replace `persist` and `loadFromKv` methods with `serialize` and `deserialize` methods on `SparseMerkleProver`
- (BREAKING) remove `numNotes` field from `AssetWithBalance`
