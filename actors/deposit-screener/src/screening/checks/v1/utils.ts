import { MisttrackRiskScoreData } from "../apiCalls";

export function isLessThanOneMonthAgo(unixTimestamp: number): boolean {
  // checks if first_seen is less than one month ago
  const now = Math.floor(Date.now() / 1000);
  const oneMonth = 60 * 60 * 24 * 30;
  return oneMonth > now - unixTimestamp;
}

export function includesMixerUsage(data: MisttrackRiskScoreData): boolean {
  return (
    data.detail_list.includes("Mixer") ||
    data.risk_detail.some((item) =>
      item.label.toLowerCase().includes("tornado.cash")
    )
  );
}
