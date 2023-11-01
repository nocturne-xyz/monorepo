import {
  EncodedAsset,
  CompressedStealthAddress,
  SubgraphUtils,
  TotalEntityIndex,
  TotalEntityIndexTrait,
  WithTotalEntityIndex,
  DepositEvent,
  DepositEventType,
} from "@nocturne-xyz/core";

const { makeSubgraphQuery } = SubgraphUtils;

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
  type?: DepositEventType;
  spender?: string;
  toIdx?: string;
}

interface FetchDepositEventsResponse {
  data: {
    depositEvents: DepositEventResponse[];
  };
}

function formDepositEventsRawQuery(
  type?: string,
  fromTotalEntityIndex?: TotalEntityIndex,
  spender?: string,
  toTotalEntityIndex?: TotalEntityIndex
) {
  const params = [];
  const conditions = [];

  if (type) {
    params.push(`$type: String!`);
    conditions.push(`type: $type`);
  }
  if (fromTotalEntityIndex) {
    params.push(`$fromIdx: String!`);
    conditions.push(`id_gte: $fromIdx`);
  }
  if (spender) {
    params.push(`$spender: Bytes!`);
    conditions.push(`spender: $spender`);
  }
  if (toTotalEntityIndex) {
    params.push(`$toIdx: String!`);
    conditions.push(`id_lt: $toIdx`);
  }

  const exists = [type, fromTotalEntityIndex, spender].some((x) => x);
  const paramsString = exists ? `(${params.join(", ")})` : "";
  const whereClause = exists ? `where: { ${conditions.join(", ")} }, ` : "";
  return `\
    query fetchDepositEvents${paramsString} {
      depositEvents(${whereClause}first: 50, orderDirection: asc, orderBy: id) {
        id
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
    fromTotalEntityIndex?: TotalEntityIndex;
    toTotalEntityIndex?: TotalEntityIndex;
    spender?: string;
  } = {}
): Promise<WithTotalEntityIndex<DepositEvent>[]> {
  const { type, fromTotalEntityIndex, toTotalEntityIndex, spender } = filter;
  const query = makeSubgraphQuery<
    FetchDepositEventsVars,
    FetchDepositEventsResponse
  >(
    endpoint,
    formDepositEventsRawQuery(
      type,
      fromTotalEntityIndex,
      spender,
      toTotalEntityIndex
    ),
    "depositEvents"
  );
  const fromIdx = fromTotalEntityIndex
    ? TotalEntityIndexTrait.toStringPadded(fromTotalEntityIndex)
    : undefined;

  const toIdx = toTotalEntityIndex
    ? TotalEntityIndexTrait.toStringPadded(toTotalEntityIndex)
    : undefined;

  const res = await query({ fromIdx, type, spender, toIdx });

  if (!res.data || res.data.depositEvents.length === 0) {
    return [];
  }

  return res.data.depositEvents.map(depositEventFromDepositEventResponse);
}

function depositEventFromDepositEventResponse(
  depositEventResponse: DepositEventResponse
): WithTotalEntityIndex<DepositEvent> {
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
    totalEntityIndex: BigInt(depositEventResponse.id),
    inner: {
      type: type as DepositEventType,
      spender,
      encodedAsset,
      value,
      depositAddr,
      nonce,
      gasCompensation,
    },
  };
}
