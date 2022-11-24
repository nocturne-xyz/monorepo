# Changelog

### Unreleased

- Add missing check to ensure `H1^vk === H2` holds
- Circuit packs points via hashing (packing via compression not possible in 254 bits)
- Build script copies Solidity verifier to `/packages/contracts/contracts`
- `vk` is derived from `sk` and circuit checks that signature corresponds to derived `sk` using `vk`
- Simplify `FLAXAddress` to only consist of H1 and H2 (no inclusion of `sk`)
- update spend2 to use new address hashing scheme (2 elements instead of 4)
- add subtreeupdate circuit and build script for it
- restructure build scripts with a layer of indirection so they can be invoked all at once
- add rapidsnark option to subtreeupdate build scripts