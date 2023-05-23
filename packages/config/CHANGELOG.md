# Changelog

### Unreleased

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
