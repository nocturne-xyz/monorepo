export const DEPOSIT_MANAGER_CONTRACT_NAME = "NocturneDepositManager";
export const DEPOSIT_MANAGER_CONTRACT_VERSION = "v1";

export const DEPOSIT_REQUEST_TYPES = {
  DepositRequest: [
    { name: "spender", type: "address" },
    { name: "encodedAsset", type: "EncodedAsset" },
    { name: "value", type: "uint256" },
    { name: "depositAddr", type: "StealthAddress" },
    { name: "nonce", type: "uint256" },
    { name: "gasCompensation", type: "uint256" },
  ],
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
};
