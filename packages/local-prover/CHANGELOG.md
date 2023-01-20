# Changelog

### Unreleased

- move `subtreeUpdateInputsFromBatch` to `sdk`
- Remove `toJSON` and all `fromJSON` methods in favor of custom `bigint-json-serialization`
- Add local prover for subtree update
- Refactor joinsplit prover to take circuit files as class fields not function args
- Rename all "flax" instances to "nocturne"
- Change package version to `-alpha`
- Add local `joinsplit` implementation and port over SDK gen test case scripts
- Add local prover package with local `spend2` prover implementation
