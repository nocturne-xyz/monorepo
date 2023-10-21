export interface TRMTransferRequest {
  accountExternalId: string; // Represents the account-external-id, ensuring no PII
  asset: string; // Supported crypto asset symbol
  assetAmount: string; // Value of transfer in units of the crypto asset
  chain: string; // Name of the supported blockchain
  destinationAddress: string; // Recipient of the transfer
  externalId: string; // ID to identify the transfer (1 to 256 characters)
  fiatCurrency: "USD"; // Hardcoded to USD as per the provided information
  fiatValue: string | null; // Value of transfer in USD or null. Pattern: /^\d+(\.\d{2})?$/
  onchainReference: string; // Onchain transaction hash for the transfer
  timestamp: string; // Onchain transaction timestamp in ISO-8601 UTC format
  transferType: "CRYPTO_WITHDRAWAL" | "CRYPTO_DEPOSIT"; // Indicates the direction of transfer
}

export interface TRMTransferResponse {
  accountExternalId: string;
  alerts: any[] | null;
  asset: string;
  assetAmount: string;
  chain: string;
  counterparties: CounterpartyMini[] | null;
  destinationAddress: string;
  externalId: string;
  fiatCurrency: "USD";
  fiatValue: string | null;
  onchainReference: string;
  riskScoreLevel: 15 | 10 | 5 | 1 | 0 | null;
  riskScoreLevelLabel: "Severe" | "High" | "Medium" | "Low" | "Unknown" | null;
  screenStatus: "FAILED" | "PROCESSING" | "SUCCEEDED";
  screenStatusFailReason:
    | "INVALID_ONCHAIN_REFERENCE"
    | "INVALID_DESTINATION_ADDRESS"
    | null;
  submittedAt: string;
  timestamp: string;
  transferType: "CRYPTO_WITHDRAWAL" | "CRYPTO_DEPOSIT";
  trmApiUrl: string;
  uuid: string;
}

export interface CounterpartyMini {
  category: string | null;
  categoryId: string | null;
  displayName: string | null;
  trmUrn: string; // Assuming 'trm-urn' is a string, adjust if needed
}
