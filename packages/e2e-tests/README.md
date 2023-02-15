# E2E Tests

## Usage

To run e2e tests, you must first build the docker images for hardhat, the bundler, and the subtree updater. Building the docker images is all handled by running `yarn prepare`. Subsequently, you can run `yarn test:e2e:no-prepare` to run the e2e tests. If you'd like to prepare and run e2e tests in one command, run `yarn test:e2e`.
