# Changelog

## 3.3.0

### Minor Changes

- 8b9d9030: add OPERATION_VALIDATION_FAILED type to OperationStatus for when re-validation fails in submitter

## 3.2.1

### Patch Changes

- 87d5bb40: dummy bump
- Updated dependencies [87d5bb40]
  - @nocturne-xyz/crypto@0.4.2

## 3.2.0

### Minor Changes

- 3ca99eaf: add txhash and timestamp to deposit event

## 3.1.4

### Patch Changes

- empty bump
- Updated dependencies
  - @nocturne-xyz/crypto@0.4.1

## 3.1.3

### Patch Changes

- 4070b154: add `gasEstimate` to `PreSignOperation`
- Updated dependencies [8973d4cb]
  - @nocturne-xyz/crypto@0.4.0

## 3.1.3-beta.0

### Patch Changes

- 4070b154: add `gasEstimate` to `PreSignOperation`
- Updated dependencies [8973d4cb]
  - @nocturne-xyz/crypto@0.4.0-beta.0

## 3.1.2

### Patch Changes

- 1b2530d1: pass logger into make subgraph utils and log errors

## 3.1.1

### Patch Changes

- 45d0719a: frontend-sdk computes gas comp for deposits if not given

## 3.1.0

### Minor Changes

- c717e4d9: Revert forcedExit changes across the stack

### Patch Changes

- a94caaec: wrap `thunk` executor in mutex
- Updated dependencies [c717e4d9]
- Updated dependencies [c717e4d9]
  - @nocturne-xyz/contracts@1.2.0

## 3.0.0

### Major Changes

- a6275d8a: - split `core` in half, creating a new `client` package that houses `NocturneClient` and everything around it
  - moved all "sync adapter" interfaces into `core`
  - moved all "sync adapter" implementations into data-source-specific packages `rpc-sync-adapters`, `subgraph-sync-adapters`, and `hasura-sync-adapters`

### Minor Changes

- 22abab87: add hasura sync adapters

### Patch Changes

- Updated dependencies [6ec2a7ac]
  - @nocturne-xyz/contracts@1.1.1

## 2.2.0

### Minor Changes

- e2801b16: (breaking) move `fetchDepositEvents` from `core` to `deposit-screener`
- f80bff6a: Add isForcedExit flag to op request builder (optional) and update op digest hashing with new flag

### Patch Changes

- 5d90ac8e: Add method for calculating joinSplitInfo and simplify that method + joinSplitInfoCommitment method to take old notes and new notes rather than specific fields
- 8b3e1b2c: scan over flattened subgraph entities
- fbfadb23: Try to make an even number of joinsplits
- Updated dependencies [54b1caf2]
- Updated dependencies [2e641ad2]
- Updated dependencies [f80bff6a]
- Updated dependencies [5d90ac8e]
- Updated dependencies [5d90ac8e]
- Updated dependencies [5d90ac8e]
- Updated dependencies [10b5bda4]
  - @nocturne-xyz/contracts@1.1.0
  - @nocturne-xyz/config@1.2.0
  - @nocturne-xyz/crypto@0.3.0

## 2.1.0

### Minor Changes

- 07625550: add `finalityBlocks` option to SDKSyncAdapter

### Patch Changes

- 7c190c2c: use `crypto` instead of `crypto-utils`
- Updated dependencies [444321c0]
- Updated dependencies [444321c0]
- Updated dependencies [444321c0]
- Updated dependencies [07625550]
- Updated dependencies [d1c549a4]
  - @nocturne-xyz/contracts@1.0.0
  - @nocturne-xyz/config@1.1.0
  - @nocturne-xyz/crypto@0.2.0

## 2.0.2

### Patch Changes

- 16dfb275: Op request gas estimation existing joinsplit case uses the entries in gasAsset estimation mapping NOT the whole map (bug led to underestimation)
- dcea2acb: Fix op request gas edge case where odd number of notes from existing joinsplits would not be accounted for in reducing num extra joinsplits by 1 (matching odd existing note with 1 new note does not increase num JSs)

## 2.0.1

### Patch Changes

- 0ed9f872: add instrumentation to give high level breakdowns on where sync overhead is
- 4d7147b6: Op request gas prep checks how many joinsplits will be added for gas compensation and updates joinsplit requests accounting for new joinsplits
- Updated dependencies [47a5f1e5]
- Updated dependencies [46e47762]
- Updated dependencies [7d151856]
- Updated dependencies [7d151856]
- Updated dependencies [46e47762]
  - @nocturne-xyz/config@1.0.0
  - @nocturne-xyz/contracts@0.5.0

## 2.0.0

### Major Changes

- 543af0b0: Replace sepolia with goerli everywhere now that we're migrating testnets

### Patch Changes

- 9fccc32f: Update joinsplit verify base amount to 300k since we added joinsplit info PI
- 543af0b0: Update try update JS requests to assume even same gas asset additions incur extra joinsplit (temp workaround)

## 1.0.0

### Major Changes

- 6abd69b9: Split out builder plugins from core, make op request builder build() async, collect array of plugin promises that resolve to unwraps, actions, refunds, and metadata
- 0cb20e3d: Op request builder takes optional nocturne config instead of teller address
- 9098e2c8: Op request builder takes provider, chainid, and optional teller address instead of chainid and networkinfo (plugins will need provider attached)
- 003e7082: double underscore unwrap, refund, and action so these are only exposed to plugins

### Minor Changes

- 81598815: - remove `signOperation` from `NocturneWalletSDK`
  - change `NocturneWalletSDK` to hold a `NocturneViewer` instead of a `NocturneSigner`
  - add method `clearDb`
  - rename `NocturneWalletSDK` to `NocturneClient`
- fc364ae8: Integrating Ruleset usage into screener server
- 77c4063c: Add functionality to snap/fe-sdk that supports signing a canon addr registry entry and returning necessary inputs for sig check proof gen
- 58b363a4: - add domain separators for nullifiers and new note nonces
  - set domain separator in initial poseidon sponge state to reduce constraint count
- 77c4063c: `CanonAddrSigCheck` circuit takes msg directly as PI instead of computing it from nonce
- 58b363a4: add `joinSplitInfoCommitment` PI to JoinSplitCircuit
- 589e0230: add sdk support for generating CanonAddrSigCheck proofs

### Patch Changes

- 003e7082: Have op request builder use minRefundValues and simplify build() logic to unwrap as few assets as possible needed for calls, additionally fix all times in core that map uses object keys by adding designated obj key map and set impls
- 1ffcf31f: update contract and sdk bundler gas comp estimate numbers
- 86d484ad: - implement plugin system for `OperationRequestBuilder` and update APIs accordingly
- 1ffcf31f: update gas calculation math in Types.sol and core op request gas to come within ~50k of actual gas spent by bundler
- 35b0f76f: change deposit request hash calculation to use ethers builtins for eip712
- 3be7d366: Strongly typed both sides of the JSON RPC boundary, between fe-sdk & snap. Shared in core
- f8046431: - fix sync issue where subtree commits weren't being detected when there are no new notes or insertions
- Updated dependencies [1ffcf31f]
- Updated dependencies [589e0230]
- Updated dependencies [6998bb7c]
- Updated dependencies [1ffcf31f]
- Updated dependencies [6998bb7c]
- Updated dependencies [77c4063c]
- Updated dependencies [58b363a4]
- Updated dependencies [77c4063c]
- Updated dependencies [de88d6f0]
- Updated dependencies [58b363a4]
  - @nocturne-xyz/contracts@0.4.0
  - @nocturne-xyz/config@0.4.0
  - @nocturne-xyz/crypto-utils@0.3.1

## 0.3.0

### Minor Changes

- fix publish command

### Patch Changes

- Updated dependencies
  - @nocturne-xyz/crypto-utils@0.3.0
  - @nocturne-xyz/contracts@0.3.0
  - @nocturne-xyz/config@0.3.0

## 0.2.0

### Patch Changes

- Updated dependencies [6c0a5d7c]
  - @nocturne-xyz/crypto-utils@0.2.0
  - @nocturne-xyz/contracts@0.2.0
  - @nocturne-xyz/config@0.2.0

### Unreleased

- Package name migrated from `sdk` to `core`
- fix bug in `toSignableOperation/toSubmittableOperation`, ensure tracked asset formatting is deterministic
- bump gas price est to 40% buffer
- Fix op digest tracking resulting in digests getting removed too early
  - Snap returns signed op and stores opdigest, site proves and submits op to bundler, snap checks if bundler has digest but bundler hasn't yet received from site, snap incorrectly deletes digest
- add `filter` to `ClosableAsyncIterator`
- `syncSDK` returns latest synced merkle index so fe-sdk can access and return
- sync adapters return latest synced merkle index
- `syncSDK` takes `SyncOpts` as params, add `timeoutSeconds` to `SyncOpts`
- set a cap on the maximum number of wasm provers spun-up in parallel
- rename/reorder some joinsplit circuit fields
- collapse tracked assets into single array and have sdk simply concat joinsplit and refund assets during translation step
- add hybrid randomization step to schnorr signing procedure to protect against fault injection attacks
- decouple spending key from schnorr signing key with sha512-based key derivation step
- this changed the type of `SpendingKey` from `bigint` to `Uint8Array`
- update test case that generates `calculatePublicInputs` test vector
- append `bitmap` to preimage of `accumulatorHash` to match contracts
- in `JoinSplitInputs` generation code, mask `encodedAsset` PIs to zero when `publicSpend` is 0.
- update `src/proof/joinsplit.ts` to match circuit with `encodedAsset` zeroing when `publicSpend` is 0
- update gas estimation logic now that `maxNumRefunds` is removed from op
- add `SubmittableOperation` types for the separation of asset index and tracked joinsplit assets (have sdk convert to submittable ops during op simulation)
- op request builder takes `.network(networkName | NetworkInfo)` now that we need chainid and teller contract for opdigest calculation
- add script to generate op digest test case for solidity unit tests
- remove custom op digest calculation for builtin ethers typed data hashing implementation
- remove chainId from operation in place of `networkInfo` used for eip712 domain hash
- change `EncryptedNote` to be an alias of `HybridCiphertext` and remove all other fields (including owner)
  - includes (many) cascading changes through sync, op preparation, and witness generation code
- add `refundAddr` circuit input
- replace `encSenderCanonAddr` with `senderCommitment`
- add contract.ts utils method for concatenating contract address and function selector
- fix eip712 deposit request typehash ordering
- remove all usage of winston logger except for in sync adapters (so we can debug test actor and snap)
- fix bug where notes with 0 value were being stored in DB
- refactor OperationMetadata to be structured
- add db test that ensures getMany doesn't returned entries for `undefined` values
- add `flatten`, `flatMap` to `ClosableAsyncIterator`
- add `collect`, `chain`, and `tapAsync` to `ClosableAsyncIterator`
- 20% buffer on sdk gas price
- wrap fetch requests in `async-retry` with exponential backoff
- fix bug in ignore indices that caused zero (dummy) notes to make sdk incorrectly ignore note at merkle index 0
- pass in optional winston logger
- remove some unnecesary logs that are left-over from debugging sessions.
- we fail to take into account extra joinsplit gas if gas asset is not already in joinsplits, we fix that in tryUpdateJoinSplitRequests
- we keep using `opRequest.joinSplitRequests.length` instead of `simulatedOp.joinSplits.length`, causes ops with > 500k worth of joinsplit verification/handling to fail
  - Fix uses simulated op joinSplits.length for gas estimation and lowers per joinSplit gas estimate
- sync through current block, not merely up to it
- add `getLatestIndexedBlock` to `SyncAdapter` and make `syncSDK` use that instead of `provider.getCurrentBlock()`
- fix `hasEnoughBalanceForOpRequest`
- fix sdk bug where using simulation maxNumRefunds was causing "too many refunds" revert
- fix edge case that can cause totalEntityIndex to go backwards in subgraph sync adapter
- sync `SDKEvent`s instead of notes and nullifiers individually
- rename `getCreationTimestampOfNewestNoteInOp` to `getCreationBlockOfNewestNoteInOp` and make it return block number instead of timestamp.
- make `NocturneDB` version itself via `TotalEntityIndex` instead of block number
- replace `WithTimestamp` with `WithTotalEntityIndex`
- sync by `TotalEntityIndex` instead of block ranges
- add dedicated module for `TotalLogIndex` and `TotalLogIndexTrait`
- `sdk.updateOptimisticRecords` now follows pattern of getting all opDigest records then going from opDigest -> opDigestRecord -> merkleIndices -> nfRecords and removing all expired/completed op digest and nf records
- change `NullifierChecker` and `BundlerNullifierChecker` to be `OpTracker` (since we now poll all info about op digest and nf records solely based on op digest)
- add methods to `NocturneDB` for storing/getting/removing op digest records
- move optimistic record types out of nocturne db into `types.ts`
- add unit tests to ensure no note re-usage and that op request builder consolidates js requests
- make creating joinsplits for js requests sequential instead of `Promise.all` + keep running list of used note merkle indices (to avoid reusing notes in same op and therefore NF conflicts)
- fix off by one error in gatherNotes which allowed us to accidentally reuse same note
- ensure checksum addressed used when storing items in DB
- ensure chain id and deadline are populated in wallet sdk
- add build with chain defaults method to `OperationRequestBuilder`
- optimsitically track nullifiers
  - store `merkleIndex -> OptimisticNFRecord` mappings in `NocturneDB`
  - refactor "getNotes" methods to take `GetNotesOpts`, which allows caller whether or not they want to include uncommitted notes and/or ignore optimistic NFs
  - add methods `applyOptimisticNullifiersForOp` and `updateOptimisticNullifiers` to `NocturneWalletSDK`, which the wallet can call to update the NF cache when it sees fit.
  - add `NullifierChecker` interface
- subgraph sync checks if `res.data` undefined
- add ElGamal encryption for canonical addresses and use in joinsplit PI generation code
- use `CompressedStealthAddress` in `EncryptedNote` and refund addr
- update joinsplit input types and encoding
- change note commmitment / hash functions to avoid potential collision using new compressed encoding
- add `CompressedStealthAddress` and methods for compressing / decompressing points and stealth addresses
- modify joinsplit indexing after removing fields from joinsplit event
- export subgraph sync fetch methods so subtree-updater can use for its own adapter
- fix off-by one bug in RPC sync adapter last committed merkle index
- RPC syncing uses joinsplits and refunds instead of insert note events
- add `emptyNote` method to `NoteTrait` in anticipation of 0 nullifier gas optimization (not nullifying empty note slots)
- add method `getCreationTimestampOfNewestNoteInOp` to SDK that allows frontends to display privacy indicators or warnings based on "age" of the notes being spent
- track creation time (in unix millis) of all notes stored in `NocturneDB`
- add `op.gasAssetRefundThreshold` functionality (opRequestGas converts 200k gas \* gasPrice into gas asset and fills gasAssetRefundThreshold field)
- sort joinsplits by encodeAsset to get gas saving in processJoinSplits
- move rest of tree constants into `treeConstants.ts`
- change `nextMerkleIndex` to `latestCommittedMerkleIndex` in NocturneDB
- make `hasEnoughBalanceForOperationRequest` call `getCommittedNotesForAsset` instead of `getNotesForAsset`
- add `getAllCommittedBalance` to `NocturneWalletSDK`
- make `gatherNotes` call `getCommittedNotesForAsset` instead of `getNotesForAsset`
- add `getAllCommittedNotes` and `getCommittedNotesForAsset` to `NotesDB`
- SMP doesn't put uncommitted notes into tree, keeping them in a persistent list instead
- move screener deposit hash calc method into sdk primitives
- fix bug in `subtreeUpdateInputsFromBatch` encoding path in wrong endianness
- fix bug resulting from `AssetTrait.decode` not returning checksum addresses
- add `unzip` to utils
- add default indexing throttle to SDK to avoid subgraph rate limits
- draw start block from config in wallet sdk
- wallet sdk holds ref to `NocturneConfig`
- fix subgraph indexing bug where we try to destructure props from empty state diff obj
- DB can return undefined for unknown start block
- fix bug in `SparseMerkleTree` where rightmost leaf is prunable, resulting in incorrect insertions
- add `fromCompressedPoints` method to `StealthAddress` trait
- add `batches` method to `ClosableAsyncIterator`
- remove `protocolWhitelistKey` fn after removing selectors from whitelist
- add optional `throttleMs` field to `IterSyncOpts` and implement it in all sync adapters
- subgraph fetch functions query via `idx_gte` and `idx_lt` instead of `id_gte` and `id_lt`
- add util method for concattenating address to selector for handler checks
- fix `SparseMerkleProver` bug where empty tree has incorrect root
- fix minor bug where SDK would override `executionGasLimit` or `maxNumRefunds` even if it was set in opRequest
- make commitment tree quaternary:
  - update `proof/joinsplit` and `proof/subtreeupdate` with new circuit input shapes
  - make `SparseMerkleProver` generic over tree arity and set arity to 4
- add x-coordinate of PK to hash in schnorr sig
- use rejection sampling to find a vkNonce such that key is in the field
- fix RPC note insertion indexing to index singular `InsertNote` events
- include `op.atomicActions` in op digest calculation
- make randomBigInt sample 32 random bytes, not 8 (bruh moment)
- add util `randomFr` to `crypto` module
- add `encRandomness` to `JoinSplitInputs`
- add `encSenderAddrC1X` and `encSenderAddrC2X` to `JoinSplitPublicSignals`
- Add `op.atomicActions = true` for current default
- `NocturneDB.nullifyNotes` and `NocturneDB.applyStateDiff` return merkle indices of nullfiied notes
- remove `getNoteCommitmentsByIndexRange` from `NocturneDB`
- `NocturneDB` now deletes nullified notes instead of turning them into leaves
- `NocturneDB` now only stores note
- add `SparseMerkleProver` that stores leaves
- remove `MerkleProver` abstraction and corresponding module
- Add `.chainId` and `.deadline` methods to `OperationRequestBuilder` and update unit tests
- Add `chainId` and `deadline` to Operation + OperationRequest
- add `BUNDLE_REVERTED` op status
- move shared subgraph utils to their own module
- fix `SubgraphSDKSyncAdapter` querying entire history instead of only specified range
- Remove `chainId` from `DepositRequest` (already included in eip712 domain)
- Make syncing rely on `handler` contract after contract separation work
- Export `IterSync` opts for `deposit-screener` package to use as well
- `iterStateDiffs` returns `ClosableAsyncIterator` not `Promise<ClosableAsyncIterator>`
- fetch latest block number subgraph has indexed in `SubgraphSyncAdapter` and don't fetch at block heights beyond that
- yield correct block number in state diffs in `RPCSyncAdapter`
- return empty array from `getNoteCommitmentsByIndexRange` if `start >= nextMerkleIndex`
- make separate multi-asset variant of depositFunds
- move gas accounting tests from `prepareOperationGas.test.ts` to `opRequestGas.test.ts`
- fix `opRequestGas` not increasing `maxNumRefunds` when joinsplits are added for gas
- increase default gas estimate per joinsplit in `opRequestGas`
- Fix `SubgraphSyncAdapter` not including `endBlock` in the range over which it emits diffs
- fix bug in `NocturneDB` where `applyStateDiff` nullifies notes before, not after adding them
- rename `NocturneContext` -> `NocturneWalletSDK`
- replace `NocturneSyncer` with a function `syncSDK`
- replace `OpProver` with a fucntion `proveOperation`
- replace `OpSigner` with a function `signOperation`
- replace `OpPreparer` with a functinon `prepareOperation`
- Add `DepositRequest` and `SignedDepositRequest` types for deposit-screener work
- replace `OpRequestPreparer` with a function `handleGasForOperationRequest` with easier-to-follow logic
- move`refundAddr` generation to `OpPreparer`
- add `Thunk` to utils
- add `SubgraphSyncAdapter`
- Add test suite for `OpRequestPreparer`
- Split out op request prepare and op prepare logic into `OpRequestPreparer` and `OpPreparer` (will be turned from classes to modules in follow on PR)
- Incorporate gas compensation logic in `OpPreparer`
- Add `FinalizedOperationRequest` type to demarcate operation request with all fields filled
- fix `NotesDB` bug where `getAllNotes` also returns note commitments
- replace separate `syncLeaves` and `SyncNotes` methods with single `sync method in NocutrneDB
- add `NocturneSyncer` to `NocturneContext`
- rename `NotesDB` -> `NocturneDB`
- get rid of `MerkleDB` and `NotesManager`
- add `currentBlock()`, `lastCommittedIndex()`, `applyStateDiff`, `getNoteCommitmentsByIndexRange()` to `NotesDB`
- add `NocturneSyncer`
- move `indexing/utils` to `utils/ethers` and get rid of `indexing` module
- add `SyncAdapter` and default impl `RPCSyncAdapter` to `sync` module
- add `ClosableAsyncIterator` to new module `sync`
- Context takes `NocturneConfig` to get wallet address (gas assets will also come from this object)
- Add `Operation.gasAsset` instead of using `joinsplits[0]`
- move `base-utils` and `primitives` back into SDK
- add more tests for new `NotesDB` impl
- fix db tests
- make `NotesManager` use `nullifyNotes` instead of looping through the entire DB
- re-implement `NotesDB` to index notes by `merkleIndex`, `nullifier`, and `asset`.
- rename `getNotesFor` -> `getNotesForAsset`
- make `OpPreparer` and `NotesManager` use `NocturneViewer` instead of `NocturneSigner`
- move `crypto`, `proof`, `note`, `asset`, and `binaryPoseidonTree`, and `commonTypes` to new package `@nocturne-xyz/primitives`
- move `utils` module to its own package
- move `ethers` utils into `indexing` module
- create `OpSimulator`
- move `signOperation` to a new class `OpSigner`
- replace `proveOperation` with `OpProver`
- replace `prepareOperation` with `OpPreparer`
- Remove `verificationGasLimit` from `Operation`
- clean module hierarchy:
  - flatten `sdk` submodule
  - remove unnecessary exports
  - make exports explicit
  - clean up imports so that they don't depend on internal structure of other modules
- merge `NocturnePrivKey` and `NocturneSigner`
- replace `circomlibjs` and `ffjavascript` with `@nocturne-xyz/crypto-utils`
- replace `NocturneContext.test.ts` with unit tests for each of the newly-split-out parts
- disembowel `NocturneContext`, reducing it to a convencience wrapper for all private state
- add new module / function `proveOperation` that separates the proving logic form `NocturneContext`
- add method `signOperation` to `NocturneSigner`
- rename `PreProofOperation` to `SignedOperation`
- add new module / function `prepareOperation` that separates `tryGetPreProofOperation` from `NocturneContext`
- add `OperationRequestBuilder`
- move `Asset` and related types / functions to new module `asset`
- Rename:
  - `NoteTransmission` -> `EncryptedNote`
  - `NocturneAddress` -> `StealthAddress`
  - `LocalNotesManager` -> `DefaultNotesManager`
  - `LocalMerkleProver` -> `InMemoryMerkleProver`
  - `LocalJoinSplitProver` -> `WasmJoinSplitProver`
  - `LocalSubtreeUpdateProver` -> `WasmSubtreeUpdateProver`
  - `JoinSplitTx` -> `JoinSplit`
  - `calculateOperationDigest` -> `computeOperationDigest`
- Fix bug where joinsplits being processed in tandem with refunds was causing some refund notes to not be removed by joinsplits
- Fix bug where zeroed dummy notes always produce same NF by generating rand address and nonce
- `LocalMerkleProver` and `LocalNotesManager` take optional start blocks as params
- Fix unawaited promise when calling `processNoteTransmission` on handling new joinsplits
- move `OperationStatus` to `commonTypes` from `@nocturne-xyz/bundler`
- remove nested hash for refund assets in `calculateOperationDigest`
- factor `proveJoiNSplitTx` into a separate function
- add function `JoinSplitPublicSignalsToArray`
- add function `unpackFromSolidityProof` to convert `SolidityProof -> BaseProof`
- factor contents of `NocturneContext.proveJoinSplitTx` into a standalone helper
- Add `makeProvenJoinSplitTx` util function that removes additional fields `PreProofJoinSplitTx` has
- Fix `NocturneContext.gatherMinimumNotes` bug by adding missing await for `this.ensureMinimumForAssetRequest` and updating test
- Depend on nocturne fork of circomlibjs
- Fix `decodeAsset` not padding out address with zeros
- Change `NocturneContext` constructor to take wallet address and provider instead of `Wallet` object
- Use `randombytes` instead of node `crypto`
- Use patched fork of `circomlibjs`
- Avoid usage of `Buffer` in `sdk`.
- Merge `joinSplitTx.encodedAssetAddr` and `joinSplitTx.encodedAssetId` into one field `joinSplitTx.encodedAsset`
- Add utility function to estimate `executionGasLimit` and `maxNumRefund`
- Change note commitment to use encoded `asset` and `ID`
- Add and `encode` and `decode` methods to `NoteTrait`
- Change `NoteInput` to `EncodedNote`
- Refactor DB interfaces
  - separate underlying `KVStore` from "DB"s by defining `KVStore` abstract class
  - implement `KVStore` with a new class `InMemoryKVStore` using a B+ Tree lib
  - split `NocturneDB` into `NotesDB` and `MerkleDB`
  - add tests
  - integrate new DB interfaces into `LocalMerkleProver`, `LocalNotesManager`, and `NocturneContext`
- Add util method for parsing events from tx receipt and break utils into `bits.ts` and `ethers.ts`
- Bug fix, `packToSolidityProof` casts numbers to bigints
- Update `gatherMinimumNotes` logic to actually gather minimum number of notes
- Add interfaces for generating and receiving confidential payments
- Remove `toJSON` and all `fromJSON` methods in favor of custom `bigint-json-serialization`
- Add query function for `SubtreeUpdate` events
- Pull out note / tree insertion fetching logic into `indexing` module
- Add `indexing` module for code that fetches data from chain
- Add interfaces for subtree update prover
- Remove unnessary normalization of circuit values
- Add context methods for ensuring min asset balance and reading all balances
- Proving no longer takes files as function args (moved to local-prover class instantiation)
- Migrate to joinsplit circuit
  - Nocturne context refractoe: Presign -> PreProof -> Proven
  - Note encryption and decryption
  - New note fetching logic
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
