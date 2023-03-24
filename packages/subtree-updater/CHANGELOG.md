# Changelog

### Unreleased

- get rid of mutex on submitter
- add `tx.wait` to submitter
- Sync tree events from `handler` contract instead of wallet post-contract-separation
- move `packToSolidityProof`, `unpackFromSolidityProof`, and `SolidityProof` into `proof/utils`
- Rename `SUBMITTER_SECRET_KEY` to `TX_SIGNER_KEY`
- Add separate script for building mock docker
- update imports with SDK renames (see SDK changelog)
- add mutex to avoid nonce conflicts when filling batch (hack)
- add CLI option to ensure a batch is submitted every time the updater polls by filling with zeros
- Add `interval` and `indexingStartBlock` as options to server
- Remove circuit-artifacts download for mock updater
- change `build_docker.sh` to avoid `docker buildx` when building mock subtree updater
- add `yarn build:mock:docker` script and corresponding functionality in `build_docker.sh`
- create separate subtree updater dockerfile that doesn't use rapidsnark
- change CLI to allow using mock subtree update prover
- fix dir not existing in rapidsnark prover
- remove install deps from dockerfile
- Add a script `yarn build:docker` to build the dockerized subtree updater
- Switch to CLI options for all non-secrets
- Add CLI instructions to readme
- Move most CLI params into env vars
- Dockerize
- Remove `toJSON` and all `fromJSON` methods in favor of custom `bigint-json-serialization`
- modify `SubtreeUpdater` to index `SubtreeUpdate` events and use those to determine when insertions are committed
- spit `tryGenAndSubmitProofs` into separate method
- separately enqueue batches to be committed
- move server to its own module
- add tests for rapidsnark prover
- add `SubtreeUpdater`
- add rapidsnark prover
