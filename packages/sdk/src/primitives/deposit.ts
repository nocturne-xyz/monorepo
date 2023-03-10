import { StealthAddress } from "../crypto";
import { EncodedAsset } from "./asset";

export interface DepositRequest {
  chainId: bigint;
  spender: string;
  encodedAsset: EncodedAsset;
  value: bigint;
  depositAddr: StealthAddress;
  nonce: bigint;
  gasPrice: bigint;
}

export interface SignedDepositRequest {
  depositRequest: DepositRequest;
  screenerSig: string;
}
