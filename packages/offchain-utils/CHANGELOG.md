# Changelog

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
