# Changelog

### Unreleased

- Update ABI after adding eth deposit support and change contract addr after needing to deploy weth in e2e tests
- Remove `chainId` from fetching deposit events
- Update deposit manager address
- Remove `wallet` in place of `handler` contract for syncing sdk events
- Add entities/events/handler for DepositManager `DepositInstantiated` event
