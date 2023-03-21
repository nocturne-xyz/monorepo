# Changelog

### Unreleased

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
