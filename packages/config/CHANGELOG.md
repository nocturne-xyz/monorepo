# Changelog

### Unreleased

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
