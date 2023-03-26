# Changelog

### Unreleased

- Deploy handler contract and remove vault
- Add subtree batch fillers args to `NocturneDeployArgs` and give them permission in `deployNocturne`
- Now deploys deposit manager and connects deposit manager to wallet (+ related checks)
- De-classify `NocturneDeployer` into just functions
- Move proxy types to `config` package and import `config`
- Clean up module hierarchy, remove unnecessary exports, and make exports explicit
- Add `tx.wait()` of configured confirmations after each tx
- Start `deploy` package
