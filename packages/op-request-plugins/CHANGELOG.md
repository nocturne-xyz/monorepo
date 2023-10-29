# Changelog

## 2.1.1

### Patch Changes

- Updated dependencies [fc7fa6c4]
  - @nocturne-xyz/config@1.4.0
  - @nocturne-xyz/client@3.0.5

## 2.1.0

### Minor Changes

- caf815d8: Modify uniswap plugin to call UniswapV3Adapter instead and take recipient (for testing)

### Patch Changes

- e7dee7e1: Fix priceImpactBps to return Bps
- Updated dependencies [317a0708]
  - @nocturne-xyz/client@3.0.4

## 2.0.3

### Patch Changes

- b49fd71f: Update ActionMetadata types to be consistent
- Updated dependencies [6fddaaa2]
- Updated dependencies [b49fd71f]
  - @nocturne-xyz/client@3.0.3

## 2.0.2

### Patch Changes

- Updated dependencies [abfab3f2]
  - @nocturne-xyz/config@1.3.1
  - @nocturne-xyz/client@3.0.2

## 2.0.1

### Patch Changes

- 4a8bb5eb: Fix uniswap plugin to directly call exactInput and exactInputSingle
- Updated dependencies [c717e4d9]
- Updated dependencies [d89a77e4]
- Updated dependencies [a94caaec]
- Updated dependencies [c717e4d9]
  - @nocturne-xyz/contracts@1.2.0
  - @nocturne-xyz/config@1.3.0
  - @nocturne-xyz/core@3.1.0
  - @nocturne-xyz/client@3.0.1

## 2.0.0

### Major Changes

- a6275d8a: - split `core` in half, creating a new `client` package that houses `NocturneClient` and everything around it
  - moved all "sync adapter" interfaces into `core`
  - moved all "sync adapter" implementations into data-source-specific packages `rpc-sync-adapters`, `subgraph-sync-adapters`, and `hasura-sync-adapters`

### Patch Changes

- b8628f56: Fixed bugs in uniswap plugin, added `getSwapRoute` fn
- b8628f56: Adds plugins to fe-sdk
- Updated dependencies [22abab87]
- Updated dependencies [a6275d8a]
- Updated dependencies [6ec2a7ac]
  - @nocturne-xyz/core@3.0.0
  - @nocturne-xyz/client@3.0.0
  - @nocturne-xyz/contracts@1.1.1

## 1.0.1

### Patch Changes

- Updated dependencies [54b1caf2]
- Updated dependencies [e2801b16]
- Updated dependencies [2e641ad2]
- Updated dependencies [f80bff6a]
- Updated dependencies [5d90ac8e]
- Updated dependencies [5d90ac8e]
- Updated dependencies [8b3e1b2c]
- Updated dependencies [f80bff6a]
- Updated dependencies [5d90ac8e]
- Updated dependencies [fbfadb23]
- Updated dependencies [5d90ac8e]
  - @nocturne-xyz/contracts@1.1.0
  - @nocturne-xyz/core@2.2.0
  - @nocturne-xyz/config@1.2.0

## 1.0.0

### Major Changes

- 444321c0: In wsteth plugin, rename 'convertWethToWsteth' to 'depositWethForWsteth'

### Patch Changes

- Updated dependencies [444321c0]
- Updated dependencies [444321c0]
- Updated dependencies [7c190c2c]
- Updated dependencies [07625550]
- Updated dependencies [444321c0]
- Updated dependencies [07625550]
  - @nocturne-xyz/contracts@1.0.0
  - @nocturne-xyz/core@2.1.0
  - @nocturne-xyz/config@1.1.0

## 0.3.1

### Patch Changes

- Updated dependencies [16dfb275]
- Updated dependencies [dcea2acb]
  - @nocturne-xyz/core@2.0.2

## 0.3.0

### Minor Changes

- 47a5f1e5: Add EthTransferAdapterPlugin and incorporate into plugins test

### Patch Changes

- 47a5f1e5: Fix wsteth adapter to weth.approve wstethAdapter first, also use ethers Interface instead of Contract where possible
- Updated dependencies [47a5f1e5]
- Updated dependencies [0ed9f872]
- Updated dependencies [46e47762]
- Updated dependencies [4d7147b6]
- Updated dependencies [7d151856]
- Updated dependencies [7d151856]
- Updated dependencies [46e47762]
  - @nocturne-xyz/config@1.0.0
  - @nocturne-xyz/core@2.0.1
  - @nocturne-xyz/contracts@0.5.0

## 0.2.1

### Patch Changes

- Updated dependencies [9fccc32f]
- Updated dependencies [543af0b0]
- Updated dependencies [543af0b0]
  - @nocturne-xyz/core@2.0.0

## 0.2.0

### Minor Changes

- 0cb20e3d: Add uniswap v3 router plugin
- 9098e2c8: Update op request builder instantiation to take provider, chainid, and optional teller contract after adding provider support to builder

### Patch Changes

- 003e7082: Plugin actual minRefundValue amounts for wsteth (equal to weth in amnt) and uniswap (refund value returned in route.quote)
- 6abd69b9: split out plugins from core package
- Updated dependencies [6abd69b9]
- Updated dependencies [81598815]
- Updated dependencies [003e7082]
- Updated dependencies [1ffcf31f]
- Updated dependencies [fc364ae8]
- Updated dependencies [0cb20e3d]
- Updated dependencies [86d484ad]
- Updated dependencies [589e0230]
- Updated dependencies [6998bb7c]
- Updated dependencies [1ffcf31f]
- Updated dependencies [77c4063c]
- Updated dependencies [6998bb7c]
- Updated dependencies [77c4063c]
- Updated dependencies [35b0f76f]
- Updated dependencies [77c4063c]
- Updated dependencies [589e0230]
- Updated dependencies [3be7d366]
- Updated dependencies [9098e2c8]
- Updated dependencies [de88d6f0]
- Updated dependencies [58b363a4]
- Updated dependencies [003e7082]
- Updated dependencies [77c4063c]
- Updated dependencies [58b363a4]
- Updated dependencies [f8046431]
  - @nocturne-xyz/core@1.0.0
  - @nocturne-xyz/contracts@0.4.0
  - @nocturne-xyz/config@0.4.0

### Unreleased
