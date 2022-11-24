# Changelog

### Unreleased

- Add scripts to generate test cases for joinsplit circuit
- Add `sdk` directory to include `db`, `merkleProver`, `notesManager` and wrap up that functionality in `FlaxContext`
- Add `FlaxLMDB` as local SDK `FlaxDB`
- Add `LocalNotesManager` as local SDK `NotesManager`
- Add `LocalMerkleProver` as local SDK `MerkleProver`
- Have all packages follow `index.ts` --> `export *` structure
- Rename spend transaction `value` to `valueToSpend`
- Add `FlaxContext` object and add functionality for converting an asset request and desired operation to a `PostProofOperation` containing potentially several spend txs
- Update `generateSpend2TestCase` script to write to `/fixtures`
- Update `FlaxSigner` to derive `vk` from `sk` and use simplified 2 field `FLAXAddress`
- Move spend2 circuit prove/verify methods into sdk
- Add babyjub classes and poseidon tree
- add script to generate input signals for `subtreeupdate` circuit 
- Fix indexing bug when only querying a single block
- Update merkle prover indexing logic to work with off-chain updates