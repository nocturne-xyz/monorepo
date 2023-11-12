# Changelog

## 0.4.1

### Patch Changes

- empty bump

## 0.4.0

### Minor Changes

- 8973d4cb: (BREAKING) split up poseidon constants and get rid of most of them

## 0.4.0-beta.0

### Minor Changes

- 8973d4cb: (BREAKING) split up poseidon constants and get rid of most of them

## 0.3.0

### Minor Changes

- 10b5bda4: override noble `fromBytes` with one that throws an error if the encoding is invalid
  - add `fromBytesUnsafe` that returns null if encoding is invalid
  - make `BabyJubJubHybridCipher` more constant-time

## 0.2.0

### Minor Changes

- d1c549a4: initial implmentation
