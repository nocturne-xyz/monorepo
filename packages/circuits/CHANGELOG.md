# Changelog

### Unreleased

- Fix regression in subtree update circuit
- Rename encodedAsset to encodedAssetAddr and encodedId to encodedAssetId
- fix endianness bug in subtree update circuit's membership proofs
- add rapidsnark setup script for subtree updater
- Add batch verifier method to auto-generated solidity verifiers
- New `joinsplit` and `joinsplit_compliance` circuit
  - Removed Spend2 and old circuits
- Rename all "flax" instances to "nocturne"
- Change package version to `-alpha`
- add script to download subtreeupdate's chonky ptau file
- add rapidsnark option to subtreeupdate build script
- restructure build scripts with a layer of indirection so they can be invoked all at once
- add subtreeupdate circuit and build script for it
- update spend2 to use new address hashing scheme (2 elements instead of 4)
- Add joinsplit circuit
- Add postprocessing script for circom generated solidity verifier
- Add missing check to ensure `H1^vk === H2` holds
- Circuit packs points via hashing (packing via compression not possible in 254 bits)
- Build script copies Solidity verifier to `/packages/contracts/contracts`
- `vk` is derived from `sk` and circuit checks that signature corresponds to derived `sk` using `vk`
- Simplify `StealthAddress` to only consist of H1 and H2 (no inclusion of `sk`)
