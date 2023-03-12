import { StealthAddress } from "../crypto";
import { EncodedAsset } from "./asset";

export interface DepositRequest {
  chainId: bigint;
  spender: string;
  encodedAsset: EncodedAsset;
  // encodedAssetAddr: bigint;
  // encodedAssetId: bigint;
  value: bigint;
  depositAddr: StealthAddress;
  // h1X: bigint;
  // h1Y: bigint;
  // h2X: bigint;
  // h2Y: bigint;
  nonce: bigint;
  gasPrice: bigint;
}

export interface SignedDepositRequest {
  depositRequest: DepositRequest;
  screenerSig: string;
}
