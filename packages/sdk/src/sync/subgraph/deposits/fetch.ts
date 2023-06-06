import { DepositRequest, EncodedAsset } from "../../../primitives";
import { CompressedStealthAddress } from "../../../crypto";
import { SubgraphUtils } from "../";

export enum DepositEventType {
  Instantiated = "Instantiated",
  Retrieved = "Retrieved",
  Processed = "Processed",
}
export interface DepositEvent extends DepositRequest {
  type: DepositEventType;
}

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
  fromIdx?: string;
  toIdx?: string;
  type?: DepositEventType;
  spender?: string;
}

interface FetchDepositEventsResponse {
  data: {
    depositEvents: DepositEventResponse[];
  };
}

function formDepositEventsRawQuery(
  type?: string,
  fromBlock?: number,
  toBlock?: number,
  spender?: string
) {
  let params = [];
  let conditions = [];

  if (type) {
    params.push(`$type: String!`);
    conditions.push(`type: $type`);
  }
  if (fromBlock) {
    params.push(`$fromIdx: Bytes!`);
    conditions.push(`idx_gte: $fromIdx`);
  }
  if (toBlock) {
    params.push(`$toIdx: Bytes!`);
    conditions.push(`idx_lt: $toIdx`);
  }
  if (spender) {
    params.push(`$spender: Bytes!`);
    conditions.push(`spender: $spender`);
  }

  const exists = [type, fromBlock, toBlock, spender].some((x) => x);
  const paramsString = exists ? `(${params.join(", ")})` : "";
  const whereClause = exists ? `(where: { ${conditions.join(", ")} })` : "";
  return `\
    query fetchDepositEvents${paramsString} {
      depositEvents${whereClause} {
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
}

export async function fetchDepositEvents(
  endpoint: string,
  filter: {
    type?: DepositEventType;
    fromBlock?: number; // the range is inclusive — i.e. [fromBlock, toBlock]
    toBlock?: number;
    spender?: string;
  } = {}
): Promise<DepositEvent[]> {
  const { type, fromBlock, toBlock, spender } = filter;
  const query = makeSubgraphQuery<
    FetchDepositEventsVars,
    FetchDepositEventsResponse
  >(
    endpoint,
    formDepositEventsRawQuery(type, fromBlock, toBlock, spender),
    "depositEvents"
  );
  const fromIdx = fromBlock
    ? totalLogIndexFromBlockNumber(BigInt(fromBlock)).toString()
    : undefined;
  const toIdx = toBlock
    ? totalLogIndexFromBlockNumber(BigInt(toBlock + 1)).toString()
    : undefined;

  const res = await query({ fromIdx, toIdx, type, spender });

  if (!res.data || res.data.depositEvents.length === 0) {
    return [];
  }

  return res.data.depositEvents.map(depositEventFromDepositEventResponse);
}

function depositEventFromDepositEventResponse(
  depositEventResponse: DepositEventResponse
): DepositEvent {
  const type = depositEventResponse.type;
  const spender = depositEventResponse.spender;

  const h1 = BigInt(depositEventResponse.depositAddrH1);
  const h2 = BigInt(depositEventResponse.depositAddrH2);
  const depositAddr: CompressedStealthAddress = { h1, h2 };

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
