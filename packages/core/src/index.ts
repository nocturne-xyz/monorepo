export * from "./utils";
export * from "./primitives";
export * from "./proof";
export * from "./store";
export * from "./sync";
export * from "./request";

export type {
  CanonAddress,
  StealthAddress,
  CompressedStealthAddress,
  NocturneSignature,
  SpendingKey,
  ViewingKey,
  SpendPk,
} from "@nocturne-xyz/crypto";
export {
  NocturneSigner,
  NocturneViewer,
  StealthAddressTrait,
  generateRandomSpendingKey,
  compressPoint,
  decompressPoint,
  decomposeCompressedPoint,
} from "@nocturne-xyz/crypto";

export { SparseMerkleProver } from "./SparseMerkleProver";
export { encryptNote, decryptNote } from "./noteEncryption";
export {
  BLOCK_GAS_LIMIT,
  MAX_GAS_FOR_ADDITIONAL_JOINSPLIT,
  GAS_PER_DEPOSIT_COMPLETE,
  maxGasForOperation,
  gasCompensationForParams,
} from "./gasCalculation";
