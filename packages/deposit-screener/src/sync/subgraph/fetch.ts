import {
  DepositRequest,
  EncodedAsset,
  StealthAddress,
} from "@nocturne-xyz/sdk";

export enum DepositEventType {
  Instantiated = "Instantiated",
  Retrieved = "Retrieved",
  Processed = "Processed",
}

export interface DepositEvent extends DepositRequest {
  type: DepositEventType;
}

export interface DepositEventResponse {
  id: string;
  type: string;
  chainId: string;
  spender: string;
  encodedAssetAddr: string;
  encodedAssetId: string;
  value: string;
  depositAddrH1X: string;
  depositAddrH1Y: string;
  depositAddrH2X: string;
  depositAddrH2Y: string;
  nonce: string;
  gasCompensation: string;
}

interface FetchDepositEventsResponse {
  data: {
    depositEvents: DepositEventResponse[];
  };
}

const depositEventsQuery = `\
  query fetchDepositEvents($fromBlock: Int!, $toBlock: Int!, $type: String!) {
    depositEvents(block: { number: $toBlock, number_gte: $fromBlock }, type: $type) {
      type
      chainId
      spender
      encodedAssetAddr
      encodedAssetId
      value
      depositAddrH1X
      depositAddrH1Y
      depositAddrH2X
      depositAddrH2Y
      nonce
      gasCompensation
    }
  }`;

// the range is exclusive - i.e. [fromBlock, toBlock)
export async function fetchDepositEvents(
  endpoint: string,
  type: DepositEventType,
  fromBlock: number,
  toBlock: number
): Promise<DepositEvent[]> {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: depositEventsQuery,
        variables: {
          type: type.toString(),
          fromBlock,
          toBlock: toBlock - 1,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Failed to fetch deposit events from subgraph: ${text}`);

      throw new Error(`Failed to deposit events from subgraph: ${text}`);
    }

    const res = (await response.json()) as FetchDepositEventsResponse;
    console.log(JSON.stringify(res));

    return res.data.depositEvents.map(depositEventFromDepositEventResponse);
  } catch (err) {
    console.error("Error when fetching deposit events from subgraph");
    throw err;
  }
}

function depositEventFromDepositEventResponse(
  depositEventResponse: DepositEventResponse
): DepositEvent {
  const type = depositEventResponse.type;
  const chainId = BigInt(depositEventResponse.chainId);
  const spender = depositEventResponse.spender;

  const h1X = BigInt(depositEventResponse.depositAddrH1X);
  const h1Y = BigInt(depositEventResponse.depositAddrH1X);
  const h2X = BigInt(depositEventResponse.depositAddrH1X);
  const h2Y = BigInt(depositEventResponse.depositAddrH1X);
  const depositAddr: StealthAddress = {
    h1X,
    h1Y,
    h2X,
    h2Y,
  };

  const encodedAssetAddr = BigInt(depositEventResponse.encodedAssetAddr);
  const encodedAssetId = BigInt(depositEventResponse.encodedAssetId);
  const encodedAsset: EncodedAsset = {
    encodedAssetAddr,
    encodedAssetId,
  };

  const nonce = BigInt(depositEventResponse.nonce);
  const value = BigInt(depositEventResponse.value);
  const gasCompensation = BigInt(depositEventResponse.gasCompensation);

  return {
    type: type as DepositEventType,
    chainId,
    spender,
    encodedAsset,
    value,
    depositAddr,
    nonce,
    gasCompensation,
  };
}
