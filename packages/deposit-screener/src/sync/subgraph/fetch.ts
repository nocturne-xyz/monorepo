import {
  EncodedAsset,
  StealthAddress,
  StealthAddressTrait,
  SubgraphUtils,
} from "@nocturne-xyz/sdk";
import { DepositEvent, DepositEventType } from "../../types";

const { makeSubgraphQuery, totalLogIndexFromBlockNumber } = SubgraphUtils;

export interface DepositEventResponse {
  id: string;
  type: string;
  chainId: string;
  spender: string;
  encodedAssetAddr: string;
  encodedAssetId: string;
  value: string;
  depositAddrH1: string;
  depositAddrH2: string;
  nonce: string;
  gasCompensation: string;
}

interface FetchDepositEventsVars {
  fromIdx: string;
  toIdx: string;
  type: DepositEventType;
}

interface FetchDepositEventsResponse {
  data: {
    depositEvents: DepositEventResponse[];
  };
}

const depositEventsQuery = `\
  query fetchDepositEvents($fromIdx: Bytes!, $toIdx: Bytes!, $type: String!) {
    depositEvents(where: { idx_gte: $fromIdx, idx_lt: $toIdx, type: $type }) {
      type
      spender
      encodedAssetAddr
      encodedAssetId
      value
      depositAddrH1
      depositAddrH2
      nonce
      gasCompensation
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

  const fromIdx = totalLogIndexFromBlockNumber(BigInt(fromBlock)).toString();
  const toIdx = totalLogIndexFromBlockNumber(BigInt(toBlock + 1)).toString();

  const res = await query({ fromIdx, toIdx, type });
  return res.data.depositEvents.map(depositEventFromDepositEventResponse);
}

function depositEventFromDepositEventResponse(
  depositEventResponse: DepositEventResponse
): DepositEvent {
  const type = depositEventResponse.type;
  const spender = depositEventResponse.spender;

  const h1 = BigInt(depositEventResponse.depositAddrH1);
  const h2 = BigInt(depositEventResponse.depositAddrH2);
  const depositAddr = StealthAddressTrait.decompress({ h1, h2 });

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
    spender,
    encodedAsset,
    value,
    depositAddr,
    nonce,
    gasCompensation,
  };
}
