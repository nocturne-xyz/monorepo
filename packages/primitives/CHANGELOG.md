# Changelog

### Unreleased

- make `NoteTrait`'s methods more generic
- add conversion helpes between note variants to `NoteTrait`
- add `IncludedNoteCommitmentWithNullifier` type
- add included note commitment type
- split unit tests that were all crammed into `NocutrneSigner.test.ts` into their own files:
	- `Asset.test.ts`
	- `StealthAddress.test.ts
	- `NocturneViewer.test.ts`
- separate viewing-key-only functionality from `NocturneSigner` into new class `NocturneViewer`