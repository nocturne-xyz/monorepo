# Changelog

### Unreleased

- fix `SubgraphScreenerSyncAdapter` querying entire history instead of only specified range
- Update eip712 signing to not include `chainId` in `DepositRequest` (already included in eip712 domain)
- make processor stoppable by renaming `run` to `start` and returning a "close" function
- print errors in console
- Fix bug where `depositRequest.depositAddr` was being incorrectly copied over from subgraph
- Add Dockerfile and docker-compose.yml
- Delete `enqueue.ts` and move logic into `processor.ts`
- Move env var parsing to CLI
- Add stubs for non-server screener functionality
  - Processor (fetches new deposit events, checks, enqueues)
  - Submitter (takes new deposit requests of queue and signs/submits)
  - DB implementation for storing rate limits and statuses
  - Sync submodule that currently only has subgraph impl
  - CLI submodule to start components
  - Screening submodule (mocked)
  - Delay sumodule (mocked)
- Break out signing and hashing into `typeData` submodule
- Add deposit request hash to contract fixture
- Add subgraph query functionality + test script to ensure it works
- Add EIP712 signing logic + script for generating fixture
