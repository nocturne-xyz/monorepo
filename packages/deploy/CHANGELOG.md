# Changelog

## 0.5.0

### Minor Changes

- 47a5f1e5: Deploy script deploys eth transfer adapter and adds to protocol allowlist

### Patch Changes

- Updated dependencies [47a5f1e5]
- Updated dependencies [0ed9f872]
- Updated dependencies [46e47762]
- Updated dependencies [4d7147b6]
- Updated dependencies [7d151856]
- Updated dependencies [7d151856]
- Updated dependencies [46e47762]
  - @nocturne-xyz/config@1.0.0
  - @nocturne-xyz/core@2.0.1
  - @nocturne-xyz/contracts@0.5.0

## 0.4.1

### Patch Changes

- Updated dependencies [9fccc32f]
- Updated dependencies [543af0b0]
- Updated dependencies [543af0b0]
  - @nocturne-xyz/core@2.0.0

## 0.4.0

### Minor Changes

- e2dfea9d: add goerli config before redeploy, fix regressions in sepolia config (`resetWindowHours` was not included in sepolia deploy config)
- 6998bb7c: add resetWindowHours to deploy config in config package and deploy package
- 77c4063c: Add CanonicalAddressRegistry and sig check verifier to deploy and config packages
- e2dfea9d: deploy script conditionally deploys wsteth adapter, takes optional wsteth adapter deploy config in deploy config json

### Patch Changes

- Updated dependencies [6abd69b9]
- Updated dependencies [81598815]
- Updated dependencies [003e7082]
- Updated dependencies [1ffcf31f]
- Updated dependencies [fc364ae8]
- Updated dependencies [0cb20e3d]
- Updated dependencies [86d484ad]
- Updated dependencies [589e0230]
- Updated dependencies [6998bb7c]
- Updated dependencies [1ffcf31f]
- Updated dependencies [77c4063c]
- Updated dependencies [6998bb7c]
- Updated dependencies [77c4063c]
- Updated dependencies [35b0f76f]
- Updated dependencies [77c4063c]
- Updated dependencies [589e0230]
- Updated dependencies [3be7d366]
- Updated dependencies [9098e2c8]
- Updated dependencies [de88d6f0]
- Updated dependencies [58b363a4]
- Updated dependencies [003e7082]
- Updated dependencies [77c4063c]
- Updated dependencies [58b363a4]
- Updated dependencies [f8046431]
  - @nocturne-xyz/core@1.0.0
  - @nocturne-xyz/contracts@0.4.0
  - @nocturne-xyz/config@0.4.0

## 0.3.0

### Minor Changes

- fix publish command

### Patch Changes

- Updated dependencies
  - @nocturne-xyz/contracts@0.3.0
  - @nocturne-xyz/config@0.3.0
  - @nocturne-xyz/core@0.3.0

## 0.2.0

### Minor Changes

- 6c0a5d7c: overhaul monorepo structure & start proper versioning system

### Patch Changes

- Updated dependencies [6c0a5d7c]
  - @nocturne-xyz/contracts@0.2.0
  - @nocturne-xyz/config@0.2.0

### Unreleased

- call whitelist on supported contracts (tokens + protocols)
- Include teller contract name and version in Teller init call
- deploy and init Handler atomically, then `setTeller` afterwards (prevent front-running)
- support separate token whitelist
- revert back to per-method protocol allowlist
- add dev only upgrade script that assumes deployer = proxyAdmin owner
- add "bump configs package` to readme
- update `README` with better instructions on how to deploy
- update sepolia deploy config
- reserve tokens to TX signer when deploying test erc20s
- checker script ensures token caps are set in dep manager and everything is whitelisted as expected
- refactor deploy fn to all handle potential token deployment, token cap setting, core contract deployment, token + protocol whitelisting, and ownership transfer
- add erc20s field to deploy configs
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
