export const DEPOSIT_CHECKER_CONTRACT_NAME = "NocturneDepositChecker";
export const DEPOSIT_CHECKER_CONTRACT_VERSION = "v1";

export interface EIP712Domain {
  name: string;
  version: string;
  chainId: bigint;
  verifyingContract: string;
}

// The named list of all type definitions
export const DEPOSIT_REQUEST_TYPES = {
  EncodedAsset: [
    { name: "encodedAssetAddr", type: "uint256" },
    { name: "encodedAssetId", type: "uint256" },
  ],
  StealthAddress: [
    { name: "h1X", type: "uint256" },
    { name: "h1Y", type: "uint256" },
    { name: "h2X", type: "uint256" },
    { name: "h2Y", type: "uint256" },
  ],
  DepositRequest: [
    { name: "chainId", type: "uint256" },
    { name: "spender", type: "string" },
    { name: "encodedAsset", type: "EncodedAsset" },
    { name: "value", type: "uint256" },
    { name: "depositAddr", type: "StealthAddress" },
    { name: "nonce", type: "uint256" },
    { name: "gasPrice", type: "uint256" },
  ],
};
