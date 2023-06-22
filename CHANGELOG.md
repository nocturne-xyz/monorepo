# Changelog (for misc. changes outside of packages)

### Unreleased

- Removed old site
- site script runs new subtree updater:
  - use docker compose
  - update env file with new redis url
- add `M1_README` for M1 users
- move `rebuild_graph_m1.sh` to root `scripts`
- add README to scripts dir
- `prepare_docker.sh` builds containers, not docker compose for bundler and deposit screener
- `prepare_docker.sh` takes a `-p` option for specifying whether or not to use rapidsnark
- rename `Wallet` to `Teller` across all packages
- instead of copying localhost config to snap, dev site rebuilds config package, then rebuilds snap, such that when snap runs, can draw on updated config pkg
- update prettier in all packages
- site script starts snap after deposit script completes
- site script points deposit-screener to config file instead of passing in wallet address
- site script points bundler to config file instead of passing in wallet address
- `yarn clean` now simply runs clean in each package and removes turbo cache
- remove fresh build from precommit hook
- add precommit hooks for lint, prettier, and fresh build
- add `--no-daemon` workaround to fix turbo (see https://github.com/vercel/turbo/issues/4137)
- site script uses explicit block time instead of automine
- site script prints handler address
- add foundryup to ci workflow
- reduce sleeps
- site script uses anvil test accounts
- site script uses anvil instead of hardhat
- site script starts anvil instead of using start
- Site script works with wallet<>handler separation
- have site script pass in subtree updater address to deploy script
- site script works with deposit screener
- site script feeds snap gas tokens
- Site script logs deposit manager
- Site script uses dockerized hardhat instead of `npx hardhat node`
- Add `yarn test:e2e` back to CI with new github workflow file
- Add root `.eslintrc` file and have all packages but `contracts` and `site` inherit from it
