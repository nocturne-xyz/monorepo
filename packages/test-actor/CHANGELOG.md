# Changelog

### Unreleased

- test actor uses lmdb kv and loads merkle from kv
- add lmdb implementation for kv store + unit tests forked from sdk unit tests
- limit test actor unwrap amount to < 2 ETH
- overshoot op gas by 20% to avoid failures due to gas price fluctuation
- add CLI options for only deposit/operations and interval time between actions
- apply optimistic NFs after preparing ops (allows submitting multiple ops for batches)
- actor draws on test erc20s and mints/deposits
