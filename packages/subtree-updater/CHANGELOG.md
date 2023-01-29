# Changelog

### Unreleased

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
