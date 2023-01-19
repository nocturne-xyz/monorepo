# Changelog

### Unreleased

- Remove unused env var from `.env.example`
- Add docker internal host gateway network to server and submitter so they can connect to hh
- Expose server ports in docker compose file
- Add `cors` middleware to server
- `BundlerServer.run` returns `http.Server`
- Merge `joinSplitTx.encodedAssetAddr` and `joinSplitTx.encodedAssetId` into one field `joinSplitTx.encodedAsset`
- Add Dockerfile and docker-compose.yml that allows you to run all three bundler components together
- Add readme explaining components and how to use the CLI tool
- Add `cli` directory to bundler + CI tests
- Add `BundlerServer`, `BundlerBatcher` and `BundlerSubmitter`
- Add `bundler` package
