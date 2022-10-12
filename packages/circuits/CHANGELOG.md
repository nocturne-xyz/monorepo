# Changelog

### Unreleased

- Build script copies Solidity verifier to `/packages/contracts/contracts`
- `vk` is derived from `sk` and circuit checks that signature corresponds to derived `sk` using `vk`
- Simplify `FLAXAddress` to only consist of H1 and H2 (no inclusion of `sk`)
