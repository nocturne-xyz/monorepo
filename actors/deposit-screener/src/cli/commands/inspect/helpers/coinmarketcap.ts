export interface PriceConversionParams {
  amount: number;
  symbol: string;
  convert: string;
}

export async function getCoinMarketCapPriceConversion(
  params: PriceConversionParams
): Promise<any> {
  const { requestInfo, requestInit } = getCoinMarketCapRequestData(params);
  return fetch(requestInfo, requestInit).then((res) => res.json());
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
