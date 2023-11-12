# Changelog

## 0.9.3

### Patch Changes

- Updated dependencies [fdefa43b]
  - @nocturne-xyz/offchain-utils@0.4.0

## 0.9.2

### Patch Changes

- @nocturne-xyz/offchain-utils@0.3.2

## 0.9.1

### Patch Changes

- @nocturne-xyz/offchain-utils@0.3.1

## 0.9.0

### Minor Changes

- caf815d8: Update uniswap fork tests to use uniswap v3 adapter and take more fork options

### Patch Changes

- Updated dependencies [724869eb]
- Updated dependencies [891de7e5]
  - @nocturne-xyz/offchain-utils@0.3.0

## 0.8.1

### Patch Changes

- Updated dependencies [26c43e44]
- Updated dependencies [2c465f4e]
- Updated dependencies [717ebcba]
  - @nocturne-xyz/offchain-utils@0.2.0

## 0.8.0

### Minor Changes

- 4a8bb5eb: allow for passing fork network and protocol allowlist to support fork uniswap fork tests
- c717e4d9: Revert forcedExit changes across the stack

### Patch Changes

- @nocturne-xyz/offchain-utils@0.1.18

## 0.7.0

### Minor Changes

- a6275d8a: - split `core` in half, creating a new `client` package that houses `NocturneClient` and everything around it
  - moved all "sync adapter" interfaces into `core`
  - moved all "sync adapter" implementations into data-source-specific packages `rpc-sync-adapters`, `subgraph-sync-adapters`, and `hasura-sync-adapters`

### Patch Changes

- @nocturne-xyz/offchain-utils@0.1.17

## 0.6.0

### Minor Changes

- 5d90ac8e: Add e2e test file for ForcedExit

### Patch Changes

- f80bff6a: Don't use base point after reverting burn addr changes
  - @nocturne-xyz/offchain-utils@0.1.16

## 0.5.2

### Patch Changes

- @nocturne-xyz/offchain-utils@0.1.15

## 0.5.1

### Patch Changes

- @nocturne-xyz/offchain-utils@0.1.14

## 0.5.0

### Minor Changes

- 47a5f1e5: Have e2e test deployment include weth, add eth transfer adapter test case in EndToEnd.ts

### Patch Changes

- @nocturne-xyz/offchain-utils@0.1.13

## 0.4.1

### Patch Changes

- @nocturne-xyz/offchain-utils@0.1.12

## 0.4.0

### Minor Changes

- fc364ae8: Integrating Ruleset usage into screener server
- 77c4063c: Add e2e tests for canon addr registry

### Patch Changes

- 1ffcf31f: update contract and sdk bundler gas comp estimate numbers
- 86d484ad: - implement plugin system for `OperationRequestBuilder` and update APIs accordingly
- 6998bb7c: add resetWindowHours to deploy config in config package and deploy package
- 6abd69b9: Update op request builder build() calls to be awaited
  - @nocturne-xyz/offchain-utils@0.1.11

## 0.3.0

### Minor Changes

- fix publish command

## 0.2.0

### Minor Changes

- 6c0a5d7c: overhaul monorepo structure & start proper versioning system

### Unreleased

- change 'alice deposits two' test case to 'alice deposits four' and have alice generate 2 JSs to test batch verify (when proofs.length > 1) functionality
- use chainid and teller contract address in op request builder post-eip712 op
- remove mint 721/1155 test case
- remove deployment and deposits of erc721/1155s
- modify sleeps after subtree update to fix flakey sync e2e tests(?)
- modify optimistic record tracking test to check op digest records
- add config option to use rapidsnark prover in e2e tests
- wait more intelligently for deposit completion
- fix bug in deploy.ts where weth was not being whitelisted
- remove `makeDepositFn` in place of directly callable function
- have deposit script collect deposit requests and console log status while waiting for screener to complete instantiated deposits
- start screener server in `screener.ts` start fn
- disable fill batch in subtree updater by default and manually fill batches in tests
- axe subtree updater recovery test
- use new subtree updater
- integrate simplified deploy script now that deploy pkg exported function handles everything including token deployment and whitelisting
- pass map of name to address for protocol whitelisting after removing fn selectors
- use multideposit after deposit manager changes
- add small function to set deposit caps to deposit manager (will be replaced by deploy script refactor to include cap setting + whitelisting all in `deployNocturne`)
- move `rebuild_graph_m1` to monorepo scripts
- deploy contract with dummy info method relinquishes ownership and is used in depositAndDeploy script
- deploy and whitelist methods in deployment use `whitelistProtocols` fn instead of custom calling handler
- add e2e test for under-gassed tx that ensures bundler marked `OPERATION_EXECUTION_FAILED`
- `testE2E` checks bundler op status
- make & write localhost config to a file in `deployAndDepositScript`
- install hardhat and run out of `e2e-tests` package
- switch back to hardhat due to very strange contract bug
- increase gas faucet amount in `EndToEnd.ts`
- Modify token deployment to take handler when so deployer can allowlist appropriate methods
- deploy weth and pass to deposit manager initialization
- update tests using `SparseMerkleProver`
- rename `NocturneSyncer.ts` -> `syncSDK.ts`
- Pass in `chainId` and `deadline` when building `OperationRequest` after adding fields to op
- `.wait()` txs in parallel in deposit functions
- reduce some sleeps
- turn on automine at the start of `setupTestDeployment` and disable it at the end
- turn on automine at the start of `deployAndDeposit` script and disable it at the end
- add timers for both `deployAndDepositScript` and `setupTestDeployment`
- Remove `chainId` from all deposit events
- add test for `SubgraphSDKSyncAdapter` block ranges
- `instantiateDeposit` calls use simplified interface without deposit request
- add missing `await` in async `expect` assertion in bundler gas test case
- instead of stopping anvil every time, reset its state to a snapshot taken at genesis
- rename `runCommandDetached` to `runCommandBackrgound` and make it non-joinable (it exits when parent node process exists)
- make `startBundler`, `startScreener`, `startSubtreeUpdater`, `startSubgraph`, `startAnvil` all return "stop" functions
- remove `yarn prepare`
- make `startBundler`, `startScreener`, and `startSubtreeUpdater` import and construct actors directly instead of using docker
- kill children in `runCommand` when parent process exits
- make `deployAndDeposit` reserve 1000 eth instead of 100 eth to deployer
- make `deployAndDeposit` wait for one confirmation on each tx
- get rid of `startHardhat`` script`
- rename `hh-node` and `hh-node-deposit` to `anvil-node` and `anvil-deposit`
- add `runCommandDetatched` util that returns a function that can be called to kill the child`
- reduce some unnecessarily-long sleeps
- move sleeps into inner actor setup / teardown fns
- switch from hh node to anvil
- Modify deployment and setup code to work with handler <> wallet separation
- in `setupTestDeployment`, give deployer EOA and subtree updater EOA subtree batch filler permission
- add `subtreeBatchFillers` param to `NocturneDeployArgs`
- make `deployAndDeposit` script take optional `SUBTREE_BATCH_FILLER` key from env
- Set depositScreener option on service deployment to `true` for all test suites
- Add deposit screener options to deploy logic
- make `OpValidator` check that op's `gasPrice` >= `gasPrice` from chain
- make `submitAndProcessOperation` return `OperationStatus`
- make bundler and subtree updater use separate EOAs in `setupTestDeployment`
- make `submitAndProcessOperation` use a retry loop and print statuses
- add gas asset to E2E test setup
- copy over named assets from SDK unit tests
- add check that bundler is compensated for gas to e2e test
- `deployContractsWithDummyAdmins` passes in alice and bob's addresses as whitelisted screeners so they can deposit (temporary until we have designated screening actor)
- refactor `deploy.ts` to separate deploying test node / contracts / actors from setting up client
- add subgraph E2E tests
- Merkle behavior changed - it now only syncs up to the latest, non-empty committed leaf
- Container names use uuid for randomness to avoid conflicts in CI
- Have `hh-node` and `hh-node-deposit` commands use dockerized hardhat
- Change deposit script token deployment to be sequential (nonce conflicts)
- Replace in memory instantiation of hardhat, subtree updater, and bundler with dockerized versions in test cases
- Add `src` to include functions previously in `utils` + actor instantiation functions (ones that use dockerode or docker-compose)
- Remove `utils` folder
- Add `hardhat` sub-package
- use `OperationRequestBuilder` for e2e tests
- update imports for new `AssetTrait`
- update imports with SDK renames (see SDK changelog)
- Replace custom hardhat deploy scripts with deploy package deploy script
- Deposit script funds with proper decimal-based amount using parseEther
- Deposit funds script sends ETH to test eth addrs
- Fill batch with zeros in deposit script
- Fix setup script regression post-upgrades, we only deploy contracts in setup script in e2e-tests, not hh-node
- Slightly modify deployNocturne script to deploy proxies without properly managing proxy admin (temporary, to be replaced by proper deploy script later)
- Deposit script creates and sends funds for two tokens
- Modify deposit script to airdrop tokens to hardcoded nocturne addresses
- Fix `localhost` hardhat network to match `hardhat node`, which hosts at `127.0.0.1` instead of `localhost`
- Break erc20 from erc721/1155 tests and use test runner pattern
- Add ERC721 and ERC1155 minting to `FullEndToEnd` test suite
- Add bundler to full e2e test, rename file from `WalletAndContext` to `FullEndToEnd`
- Change e2e-test to test erc20.trasfer, refund, and confidential payments
- Add check for `OperationProcessed` event
- Add e2e-test for standalone `SubtreeUpdateServer`
- Modify e2e-test to use `SubtreeUpdater`
- Modified e2e-test to use joinsplit
- Rename all "flax" instances to "nocturne"
- Change package version to `-alpha`
- Move contract setup to hardhat deploy script method `setup` (allows us to deploy against local hh node)
- Modify tests tests to use `Wallet` which now internally uses `OffchainMerkleTree` as a lib
- Modify tests to use `OffchainMerkleTree` with dummy ZK tree updates
- Modify `WalletAndNocturneContext` to use local merkle prover and notes managers to sync state and generate proof for bundle
- Add `LocalMerkleProver` test suite to check syncing functionality
- Refactor single test case to `NocturneContext`
- Add initial test case to transfer 50 tokens from 100 token note from Alice to Bob
