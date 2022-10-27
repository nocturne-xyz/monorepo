export { BinaryPoseidonTree } from "./src/primitives/binaryPoseidonTree";
export { Note } from "./src/sdk/note";
export { FlaxSignature, FlaxSigner } from "./src/sdk/signer";
export { MerkleProver } from "./src/sdk/merkleProver";
export {
  NotesManager,
  ChainIndexingNotesManager,
} from "./src/sdk/notesManager";
export { FlaxAddress } from "./src/crypto/address";
export { FlaxPrivKey } from "./src/crypto/privkey";
export { SolidityProof } from "./src/contract/proof";
export { NoteInput, Spend2Inputs, MerkleProofInput } from "./src/proof/spend2";
export { FlattenedFlaxAddress } from "./src/crypto/address";
export * from "./src/contract/types";
export * from "./src/commonTypes";

export {
  proveSpend2,
  verifySpend2Proof,
  normalizeSpend2Inputs,
  publicSignalsArrayToTyped,
} from "./src/proof/spend2";
export { packToSolidityProof } from "./src/contract/proof";
export { calculateOperationDigest } from "./src/contract/utils";

export { FlaxContext } from "./src/FlaxContext";
