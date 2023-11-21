import { MisttrackRiskScoreData } from "../apiCalls";
import moment from "moment-timezone";

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
      item.label.toLowerCase().includes("tornado")
    )
  );
}

// August 8, 2022 + 2 months = October 8, 2022
const tornadoCashSanctionUnixTime = new Date("2022-10-08").getTime() / 1000;
export function isCreatedAfterTornadoCashSanction(
  unixTimestamp: number
): boolean {
  // checks if wallet is created after tornado cash sanction
  return tornadoCashSanctionUnixTime < unixTimestamp;
}

export const timeUntil7AMNextDayInSeconds = (): number => {
  const currentTime = moment().tz("America/New_York");
  const sevenAMNextDay = currentTime
    .clone()
    .add(1, "days")
    .hour(7)
    .minute(0)
    .second(0);

  // Calculate the duration in seconds
  return sevenAMNextDay.diff(currentTime, "seconds");
};
