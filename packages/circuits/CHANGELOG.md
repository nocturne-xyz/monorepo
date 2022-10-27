# Changelog

### Unreleased

- Add `newNonce` as output signal to enforce nonce in `SpendTransaction` is correct with `newNoteCommitment`
- Add missing check to ensure `H1^vk === H2` holds
- Circuit packs points via hashing (packing via compression not possible in 254 bits)
- Build script copies Solidity verifier to `/packages/contracts/contracts`
- `vk` is derived from `sk` and circuit checks that signature corresponds to derived `sk` using `vk`
- Simplify `FLAXAddress` to only consist of H1 and H2 (no inclusion of `sk`)
