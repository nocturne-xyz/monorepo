---
"@nocturne-xyz/client": major
---

- (BREAKING) add `NocturneClientState` as an alternative to `NocturneDB` that's a synchronous in-memory object with `save` and `load` methods
- (BREAKING) axe `NocturneDB`
- (BREAKING) `NocturneClient` takes `NocturneClientState` instead of `merkleProver` and `db` in ctor
- (BREAKING) replace all usage of `NocturneDB` with `NocturneClientState` in `NocturneClient`:
  - make some methods syncrhonous
  - convert some methods into getters
