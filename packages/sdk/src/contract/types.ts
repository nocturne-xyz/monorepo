import { FlaxAddress } from "../crypto/crypto";

export interface Note {
  owner: FlaxAddress;
  nonce: bigint;
  type: bigint;
  id: bigint;
  value: bigint;
}
