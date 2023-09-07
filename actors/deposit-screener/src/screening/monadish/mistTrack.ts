import { ScreeningDepositRequest } from "..";

export interface MistTrackRiskDetail {
  label: string;
  type: string;
  volume: number;
  address: string;
  percent: number;
}

export type MistTrackRiskItem =
  | "Malicious Address"
  | "Suspected Malicious Address"
  | "High-risk Tag Address"
  | "Medium-risk Tag Address"
  | "Mixer"
  | "Risk Exchange"
  | "Gambling"
  | "Involved Theft Activity"
  | "Involved Ransom Activity"
  | "Involved Phishing Activity"
  | "Interact With Malicious Address"
  | "Interact With Suspected Malicious Address"
  | "Interact With High-risk Tag Address"
  | "Interact With Medium-risk Tag Addresses";

type UnixTimestamp = number;

export interface MistTrackAddressOverviewData {
  balance: number;
  txs_count: number;
  first_seen: UnixTimestamp;
  last_seen: UnixTimestamp;
  total_received: number;
  total_spent: number;
  received_txs_count: number;
  spent_txs_count: number;
}
export interface MistTrackRiskScoreData {
  score: number;
  hacking_event: string;
  detail_list: MistTrackRiskItem[];
  risk_level: "Low" | "Moderate" | "High" | "Severe";
  risk_detail: MistTrackRiskDetail[];
}
type MistTrackData = MistTrackRiskScoreData | MistTrackAddressOverviewData;

export type MistTrackApiResponse<T extends MistTrackData> =
  | {
      success: false;
      msg: string;
    }
  | {
      success: true;
      data: T;
    };

export interface DummyMistTrackData {
  MistTrackRisk: number;
}

const MistTrack_BASE_URL = "https://openapi.MistTrack.io/v1";
const MistTrack_API_KEY = "YourApiKey";

export async function mistTrackAddressOverview(
  deposit: ScreeningDepositRequest,
): Promise<MistTrackAddressOverviewData> {
  const token = "ETH";
  const response = await fetch(
    `${MistTrack_BASE_URL}/address_overview?coin=${token}address=${deposit.spender}&api_key=${MistTrack_API_KEY}`
  );
  const MistTrackResponse =
    (await response.json()) as MistTrackApiResponse<MistTrackAddressOverviewData>;
  if (!MistTrackResponse.success) {
    throw new Error(
      `Call to MistTrack failed with message: ${MistTrackResponse.msg}`
    );
  }
  console.log(MistTrackResponse.data);
  return MistTrackResponse.data;
}

export async function mistTrackAddressRiskScore(
  deposit: ScreeningDepositRequest,
): Promise<MistTrackRiskScoreData> {
  const token = "ETH";
  const response = await fetch(
    `${MistTrack_BASE_URL}/risk_score?coin=${token}&address=${deposit.spender}&api_key=${MistTrack_API_KEY}`
  );
  const MistTrackResponse =
    (await response.json()) as MistTrackApiResponse<MistTrackRiskScoreData>;
  if (!MistTrackResponse.success) {
    throw new Error(
      `Call to MistTrack failed with message: ${MistTrackResponse.msg}`
    );
  }
  console.log(MistTrackResponse.data);
  return MistTrackResponse.data;
}

export async function dummyMistTrackAddressRiskScore(
  deposit: ScreeningDepositRequest,
): Promise<DummyMistTrackData> {
  console.log(deposit);
  return await Promise.resolve({ MistTrackRisk: 0.5 });
}
