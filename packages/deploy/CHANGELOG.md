# Changelog

### Unreleased

- protocol whitelisting removes function selectors
- add deploy config for sepolia
- separate ownership transferral from contract deployment
- add `whitelistProtocols` function
- remove empty `console.log()` in place of `\n` again
- separate configs types out into separate `config.ts` again
- add `protocolAllowlist` to example config
- take data out of env vars and put into config.json
- make contract owners same as proxy admin owner, in practice proxy admin owner will be gnosis safe and we want that same contract to have ownership of contracts
- Pass weth to deposit manager initialization
- Deploy handler contract and remove vault
- Add subtree batch fillers args to `NocturneDeployArgs` and give them permission in `deployNocturne`
- Now deploys deposit manager and connects deposit manager to wallet (+ related checks)
- De-classify `NocturneDeployer` into just functions
- Move proxy types to `config` package and import `config`
- Clean up module hierarchy, remove unnecessary exports, and make exports explicit
- Add `tx.wait()` of configured confirmations after each tx
- Start `deploy` package
