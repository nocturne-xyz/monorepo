export { BinaryPoseidonTree } from "./src/primitives/binaryPoseidonTree";
export {
  FlaxAddress,
  FlaxPrivKey,
  FlaxSignature,
  FlaxSigner,
} from "./src/crypto/crypto";
export { SolidityProof } from "./src/contract/proof";
export {
  NoteInput,
  Spend2Inputs,
  FlaxAddressInput,
  MerkleProofInput,
} from "./src/proof/spend2";
export * from "./src/contract/types";

export {
  proveSpend2,
  verifySpend2Proof,
  normalizeSpend2Inputs,
  publicSignalsArrayToTyped,
} from "./src/proof/spend2";
export { packToSolidityProof } from "./src/contract/proof";
export {
  hashOperation,
  hashSpend,
  calculateOperationDigest,
} from "./src/contract/utils";
export { SNARK_SCALAR_FIELD } from "./src/proof/common";
