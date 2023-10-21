# Changelog

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
