# Changelog

### Unreleased

- add tree insertion events
- store entity id in bigint form in new field `idx` for every entity
- add `mainnet` (which actually points to locahost) to `networks.json`
  - TODO: figure out how to differentiate between locally-deployed mainnet and actual mainnet in config
- update ABI after renaming wallet to teller
- update ABI after adding encrypted sender addr to joinsplit struct
- Update ABI after adding eth deposit support and change contract addr after needing to deploy weth in e2e tests
- Remove `chainId` from fetching deposit events
- Update deposit manager address
- Remove `wallet` in place of `handler` contract for syncing sdk events
- Add entities/events/handler for DepositManager `DepositInstantiated` event
