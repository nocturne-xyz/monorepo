# Changelog

### Unreleased

- Rename spend transaction `value` to `valueToSpend`
- Add `FlaxContext` object and add functionality for converting an asset request and desired operation to a `PostProofOperation` containing potentially several spend txs
- Update `generateSpend2TestCase` script to write to `/fixtures`
- Update `FlaxSigner` to derive `vk` from `sk` and use simplified 2 field `FLAXAddress`
- Move spend2 circuit prove/verify methods into sdk
- Add babyjub classes and poseidon tree
