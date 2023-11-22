# Changelog

## 0.6.5

### Patch Changes

- @nocturne-xyz/persistent-log@0.1.15

## 0.6.4

### Patch Changes

- 5a3afc72: fix bug where response.clone() was prematurely consuming response, ser then deser to deep copy

## 0.6.3

### Patch Changes

- c390746f: Publish via yarn publish-packages not yarn changeset publish

## 0.6.2

### Patch Changes

- b7febfca: getting oz tx submitter from env propagates OZ_RELAYER_SPEED

## 0.6.1

### Patch Changes

- 87d5bb40: dummy bump
- Updated dependencies [87d5bb40]
  - @nocturne-xyz/persistent-log@0.1.14

## 0.6.0

### Minor Changes

- 4aff3cd3: add tx submitter classes for ethers wallet and oz relayer

## 0.5.1

### Patch Changes

- @nocturne-xyz/persistent-log@0.1.13

## 0.5.0

### Minor Changes

- fd8709ed: Add geo middleware

## 0.4.1

### Patch Changes

- empty bump
- Updated dependencies
  - @nocturne-xyz/persistent-log@0.1.12

## 0.4.0

### Minor Changes

- fdefa43b: Add custom log levels with compliance level

### Patch Changes

- @nocturne-xyz/persistent-log@0.1.11

## 0.4.0-beta.0

### Minor Changes

- fdefa43b: Add custom log levels with compliance level

### Patch Changes

- @nocturne-xyz/persistent-log@0.1.11-beta.0

## 0.3.2

### Patch Changes

- @nocturne-xyz/persistent-log@0.1.10

## 0.3.1

### Patch Changes

- @nocturne-xyz/persistent-log@0.1.9

## 0.3.0

### Minor Changes

- 724869eb: createLogger defaults to stdout transports and adds file logs if logDir is given
- 891de7e5: Dry up ethers, defender config code and add to offchain utils

## 0.2.0

### Minor Changes

- 26c43e44: Expose method for creating observable gauge
- 717ebcba: add cachedFetch method to ser/deser and read/write reponses to redis cache

### Patch Changes

- 2c465f4e: Initial postgres support

## 0.1.18

### Patch Changes

- @nocturne-xyz/persistent-log@0.1.8

## 0.1.17

### Patch Changes

- @nocturne-xyz/persistent-log@0.1.7

## 0.1.16

### Patch Changes

- @nocturne-xyz/persistent-log@0.1.6

## 0.1.15

### Patch Changes

- @nocturne-xyz/persistent-log@0.1.5

## 0.1.14

### Patch Changes

- @nocturne-xyz/persistent-log@0.1.4

## 0.1.13

### Patch Changes

- @nocturne-xyz/persistent-log@0.1.3

## 0.1.12

### Patch Changes

- @nocturne-xyz/persistent-log@0.1.2

## 0.1.11

### Patch Changes

- Updated dependencies [27cb1b5c]
  - @nocturne-xyz/persistent-log@0.1.1

### Unreleased

- move redis out to remove peer-dependency on `ioredis`
- add `opentelemetry` default instrumentation + metric name formatting util
- add `HealthCheckResponse`
- move redis, ajv, and actor related utils to this pkg so bundler and screener can share code
- `makeLogger` adds console exceptionHandlers/rejectionHandlers if `consoleLevel` is defined
- add loggers
