export { BinaryPoseidonTree } from "./src/primitives/binaryPoseidonTree";
export {
  FlaxAddress,
  FlaxPrivKey,
  FlaxSignature,
  FlaxSigner,
} from "./src/crypto/crypto";
export { SolidityProof } from "./src/proof/solidity";
export {
  NoteInput,
  Spend2Inputs,
  FlaxAddressInput,
  MerkleProofInput,
} from "./src/proof/spend2";

export { proveSpend2, verifySpend2Proof } from "./src/proof/spend2";
export { packToSolidityProof } from "./src/proof/solidity";
export { SNARK_SCALAR_FIELD } from "./src/proof/common";
