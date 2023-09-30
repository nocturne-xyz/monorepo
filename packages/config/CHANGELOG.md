# Changelog

## 1.2.0

### Minor Changes

- 5d90ac8e: Add config field for poseidonExtT7 hasher

## 1.1.0

### Minor Changes

- 07625550: add optional `finalityBlocks` to config's `network` property that makes it easier to set `finalityBlocks` in sync logic across the codebase

## 1.0.0

### Major Changes

- 47a5f1e5: Convert the address and network related fns to getters

### Minor Changes

- 46e47762: Add eth transfer adapter to goerli config after deploying via forge script

## 0.4.0

### Minor Changes

- 6998bb7c: add resetWindowHours to deploy config in config package and deploy package
- 77c4063c: Add CanonicalAddressRegistry and sig check verifier to deploy and config packages

## 0.3.0

### Minor Changes

- fix publish command

## 0.2.0

### Minor Changes

- 6c0a5d7c: overhaul monorepo structure & start proper versioning system

### Unreleased

- ensure all loaded addrs are checksum addresses by adding parsing util fn
- redeploy sepolia post gas-optimization PRs
- add `request` module which contains req/res types for bundler/screener servers
- update sepolia config
- update sepolia config
- add unit test for serializing/deserializing config
- remove `ProtocolAllowlist` alias
- fix existing example and sepolia configs to fit new schema
- remove gas assets + rate limits and consolidate info around contracts, erc20s, and whitelisted protocols
- protocol whitelist field removes function selectors
- create separate `docker-compose.local.yml` and `docker-compose.dev.yml` where `dev` version pulls from docker hub
- add config for newly deployed sepolia contracts
- expose `loadNocturneConfigBuiltin` which avoids FS access
- add `protocolAllowlist` to NocturneConfig
- add `toString`, `fromString` methods to avoid direct map serialization
- add `fromObject` method
- Add `handler` (remove vault) and add `handlerOwner`
- Add checks in single unit test to ensure fields are defined
- Add `depositManager`, `depositSources`, `screeners`, and `owners` (added `walletOwner` and `depositManagerOwner` fields)
- Start `@nocturne-xyz/config` package
