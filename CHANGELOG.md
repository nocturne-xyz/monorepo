# Changelog (for misc. changes outside of packages)

### Unreleased

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
