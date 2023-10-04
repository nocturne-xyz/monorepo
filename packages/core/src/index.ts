export * as utils from "./utils";
export * as primitives from "./primitives";
export * as proofs "./proof";
export * as store from "./store";
export * as sync from "./sync";
export * from "./request";

import {
  NocturneSigner,
  NocturneViewer,
  generateRandomSpendingKey,
  StealthAddress,
  CompressedStealthAddress,
  CanonAddress,
  StealthAddressTrait,
  compressPoint,
  decompressPoint,
  decomposeCompressedPoint,
  SpendingKey,
  ViewingKey,
  SpendPk,
} from "@nocturne-xyz/crypto";

export const crypto = {
  NocturneSigner,
  NocturneViewer,
  generateRandomSpendingKey,
  StealthAddress,
  CompressedStealthAddress,
  CanonAddress,
  StealthAddressTrait,
  compressPoint,
  decompressPoint,
  decomposeCompressedPoint,
  SpendingKey,
  ViewingKey,
  SpendPk, 
};

export { SparseMerkleProver } from "./SparseMerkleProver";
export { encryptNote, decryptNote } from "./noteEncryption";
