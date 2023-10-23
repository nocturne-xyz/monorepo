import { cachedFetch } from "@nocturne-xyz/offchain-utils";
import IORedis from "ioredis";

export interface PriceConversionParams {
  amount: number;
  symbol: string;
  convert: string;
}

interface PriceConversionResponse {
  data: [
    {
      symbol: string;
      id: string;
      name: string;
      amount: number;
      last_updated: string;
      quote: {
        [key: string]: {
          price: number;
          last_updated: string;
        };
      };
    }
  ];
  status: {
    timestamp: string;
    error_code: number;
    error_message: string;
    elapsed: number;
    credit_count: number;
    notice: string;
  };
}

export async function getCoinMarketCapPriceConversion(
  params: PriceConversionParams,
  redis: IORedis
): Promise<PriceConversionResponse> {
  const { requestInfo, requestInit } = getCoinMarketCapRequestData(params);
  return cachedFetch(requestInfo, requestInit, redis).then((res) => res.json());
}

function mustGetCoinMarketCapApiKey(): string {
  if (!process.env.COINMARKETCAP_API_KEY) {
    throw new Error("COINMARKETCAP_API_KEY not set");
  }
  return process.env.COINMARKETCAP_API_KEY;
}

function getCoinMarketCapRequestData(params: PriceConversionParams): {
  requestInfo: string;
  requestInit: RequestInit;
} {
  const apiKey = mustGetCoinMarketCapApiKey();
  const requestInfo = `https://pro-api.coinmarketcap.com/v2/tools/price-conversion?amount=${params.amount}&symbol=${params.symbol}&convert=${params.convert}&CMC_PRO_API_KEY=${apiKey}`;
  const requestInit: RequestInit = {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  };
  return { requestInfo, requestInit };
}
