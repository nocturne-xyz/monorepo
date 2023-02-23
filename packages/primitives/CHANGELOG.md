# Changelog

### Unreleased

- split unit tests that were all crammed into `NocutrneSigner.test.ts` into their own files:
	- `Asset.test.ts`
	- `StealthAddress.test.ts
	- `NocturneViewer.test.ts`
- separate viewing-key-only functionality from `NocturneSigner` into new class `NocturneViewer`