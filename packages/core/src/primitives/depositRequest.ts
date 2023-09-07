import { DepositRequest } from "./types";
import { ethers } from "ethers";

const { _TypedDataEncoder } = ethers.utils;

const DEPOSIT_REQUEST_TYPES = {
  DepositRequest: [
    { name: "spender", type: "address" },
    { name: "encodedAsset", type: "EncodedAsset" },
    { name: "value", type: "uint256" },
    { name: "depositAddr", type: "CompressedStealthAddress" },
    { name: "nonce", type: "uint256" },
    { name: "gasCompensation", type: "uint256" },
  ],
  EncodedAsset: [
    { name: "encodedAssetAddr", type: "uint256" },
    { name: "encodedAssetId", type: "uint256" },
  ],
  CompressedStealthAddress: [
    { name: "h1", type: "uint256" },
    { name: "h2", type: "uint256" },
  ],
};

export function hashDepositRequest(depositRequest: DepositRequest): string {
  return _TypedDataEncoder.hashStruct(
    "DepositRequest",
    DEPOSIT_REQUEST_TYPES,
    depositRequest
  );
}
