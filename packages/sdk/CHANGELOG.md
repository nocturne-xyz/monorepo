# Changelog

### Unreleased

- create separate "indexing" module for shared indexing logic
- separate out subtree update input signal gen into its own module
- Rename all "flax" instances to "nocturne"
- Change package version to `-alpha`
- Break out SDK methods into sub methods and expose a method for gathering spend tx inputs for site/snap to use
- Replace `LMDB` with `ObjectDB`, which fits structure of MM snap schema
- Take out all fs and proving related capabilities from SDK and replace with blank interfaces (turn SDK into shim)
- Rename `PostProof` to `Proven` among data types
- add `update` method to `BinaryPoseidonTree`
- use `bigint-conversion` for bigint packing stuff
- Update merkle prover indexing logic to work with off-chain updates
- add script to generate input signals for `subtreeupdate` circuit
- Fix indexing bug when only querying a single block
- Add scripts to generate test cases for joinsplit circuit
- Add `sdk` directory to include `db`, `merkleProver`, `notesManager` and wrap up that functionality in `NocturneContext`
- Add `NocturneLMDB` as local SDK `NocturneDB`
- Add `LocalNotesManager` as local SDK `NotesManager`
- Add `LocalMerkleProver` as local SDK `MerkleProver`
- Have all packages follow `index.ts` --> `export *` structure
- Rename spend transaction `value` to `valueToSpend`
- Add `NocturneContext` object and add functionality for converting an asset request and desired operation to a `PostProofOperation` containing potentially several spend txs
- Update `generateSpend2TestCase` script to write to `/fixtures`
- Update `NocturneSigner` to derive `vk` from `sk` and use simplified 2 field `NocturneAddress`
- Move spend2 circuit prove/verify methods into sdk
- Add babyjub classes and poseidon tree
