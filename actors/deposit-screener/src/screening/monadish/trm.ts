import { ScreeningDepositRequest } from "..";

export interface TrmAddressRiskIndicator {
  category: string;
  categoryId: string;
  categoryRiskScoreLevel: number;
  categoryRiskScoreLevelLabel:
    | null
    | "Unknown"
    | "Low"
    | "Medium"
    | "High"
    | "Severe";
  incomingVolumeUsd: string;
  outgoingVolumeUsd: string;
  riskType: "COUNTERPARTY" | "OWNERSHIP" | "INDIRECT";
  totalVolumeUsd: string;
}
export interface TrmData {
  externalId: string;
  addressIncomingVolumeUsd: string;
  addressOutgoingVolumeUsd: string;
  addressTotalVolumeUsd: string;
  addressRiskIndicators: TrmAddressRiskIndicator[];
}

export interface DummyTrmData {
  risk: number;
}

const TRM_BASE_URL = "https://api.trmlabs.com/public/v2";
const TRM_API_KEY = ""; // TODO get from env, once we start paying for TRM

export async function trmScreeningAddresses(
  deposit: ScreeningDepositRequest
): Promise<TrmData> {
  const body = JSON.stringify({
    address: deposit.spender,
    chain: "ethereum",
  });
  const response = await fetch(`${TRM_BASE_URL}/screening/addresses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:
        "Basic " +
        Buffer.from(`${TRM_API_KEY}:${TRM_API_KEY}`).toString("base64"),
    },
    body,
  });
  const data = (await response.json())[0] as TrmData;
  console.log(data);
  return data;
}


export async function dummyTrmScreeningAdresses(deposit: ScreeningDepositRequest): Promise<DummyTrmData> {
  console.log(deposit);
  return await Promise.resolve({ risk: 0.5 });
}
