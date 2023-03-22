import {
  EncodedAsset,
  StealthAddress,
  makeSubgraphQuery,
} from "@nocturne-xyz/sdk";
import { DepositEvent, DepositEventType } from "../../types";

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
  depositHash: string;
}

interface FetchDepositEventsVars {
  fromBlock: number;
  toBlock: number;
  type: DepositEventType;
}

interface FetchDepositEventsResponse {
  data: {
    depositEvents: DepositEventResponse[];
  };
}

const depositEventsQuery = `\
  query fetchDepositEvents($fromBlock: Int!, $toBlock: Int!, $type: String!) {
    depositEvents(block: { number_gte: $fromBlock, number: $toBlock }, where: { type: $type }) {
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
      depositHash
    }
  }`;

// the range is inclusive - i.e. [fromBlock, toBlock]
export async function fetchDepositEvents(
  endpoint: string,
  type: DepositEventType,
  fromBlock: number,
  toBlock: number
): Promise<DepositEvent[]> {
  const query = makeSubgraphQuery<
    FetchDepositEventsVars,
    FetchDepositEventsResponse
  >(endpoint, depositEventsQuery, "depositEvents");
  const res = await query({ fromBlock, toBlock, type });
  return res.data.depositEvents.map(depositEventFromDepositEventResponse);
}

function depositEventFromDepositEventResponse(
  depositEventResponse: DepositEventResponse
): DepositEvent {
  console.log("DEPOSIT HASH:", depositEventResponse.depositHash);
  const type = depositEventResponse.type;
  const chainId = BigInt(depositEventResponse.chainId);
  const spender = depositEventResponse.spender;

  const h1X = BigInt(depositEventResponse.depositAddrH1X);
  const h1Y = BigInt(depositEventResponse.depositAddrH1Y);
  const h2X = BigInt(depositEventResponse.depositAddrH2X);
  const h2Y = BigInt(depositEventResponse.depositAddrH2Y);
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
